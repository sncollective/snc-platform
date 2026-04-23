import { Hono } from "hono";

import { UploadPurposeSchema } from "@snc/shared";
import type {
  TusdHookRequest,
  TusdHookResponse,
  TusdStorageS3,
  UploadPurpose,
} from "@snc/shared";

import type { AuthEnv } from "../middleware/auth-env.js";
import { auth } from "../auth/auth.js";
import { hydrateAuthContext } from "../middleware/auth-helpers.js";
import { completeUploadFlow } from "../services/upload-completion.js";
import { storage } from "../storage/index.js";
import { rootLogger } from "../logging/logger.js";

// ── Private Constants ──

/** Upload purposes routed through tus (large media files). */
const TUS_PURPOSES: ReadonlySet<UploadPurpose> = new Set<UploadPurpose>([
  "content-media",
  "playout-media",
]);

// ── Private Helpers ──

function headerValue(
  headers: Record<string, readonly string[]>,
  name: string,
): string | undefined {
  return headers[name]?.[0] ?? headers[name.toLowerCase()]?.[0];
}

function rejectUpload(statusCode: number, message: string): TusdHookResponse {
  return {
    RejectUpload: true,
    HTTPResponse: {
      StatusCode: statusCode,
      Body: JSON.stringify({ error: { code: "UPLOAD_REJECTED", message } }),
      Header: { "Content-Type": "application/json" },
    },
  };
}

/**
 * Validate the tusd pre-create hook: authenticate the forwarded session,
 * verify the upload purpose is allowed via tus, and confirm resourceId
 * metadata is present. Ownership is deferred to post-finish.
 */
async function handlePreCreate(
  body: TusdHookRequest,
): Promise<TusdHookResponse> {
  const cookieHeader = headerValue(body.Event.HTTPRequest.Header, "Cookie");
  const authHeader = headerValue(body.Event.HTTPRequest.Header, "Authorization");

  if (!cookieHeader && !authHeader) {
    return rejectUpload(401, "Missing authentication");
  }

  const headers = new Headers();
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  if (authHeader) headers.set("Authorization", authHeader);

  const session = await auth.api.getSession({ headers });
  if (!session) {
    return rejectUpload(401, "Invalid session");
  }

  const rawPurpose = body.Event.Upload.MetaData["purpose"];
  const purposeResult = UploadPurposeSchema.safeParse(rawPurpose);
  if (!purposeResult.success) {
    return rejectUpload(400, `Invalid upload purpose: ${rawPurpose ?? "missing"}`);
  }

  const purpose = purposeResult.data;
  if (!TUS_PURPOSES.has(purpose)) {
    return rejectUpload(400, `Purpose '${purpose}' is not allowed via tus`);
  }

  const resourceId = body.Event.Upload.MetaData["resourceId"];
  if (!resourceId) {
    return rejectUpload(400, "Missing resourceId metadata");
  }

  return {};
}

/**
 * Handle tusd post-finish hook: upload is committed to S3. Extract the
 * key and metadata, re-authenticate from forwarded headers, then run the
 * shared completion flow (ownership, size check, DB record, job queue).
 */
async function handlePostFinish(body: TusdHookRequest): Promise<void> {
  const { Upload } = body.Event;
  const s3Storage = Upload.Storage as TusdStorageS3;

  if (s3Storage.Type !== "s3store") {
    rootLogger.error(
      { storageType: s3Storage.Type },
      "tusd post-finish: unexpected storage type",
    );
    return;
  }

  const rawPurpose = Upload.MetaData["purpose"];
  const resourceId = Upload.MetaData["resourceId"];
  const s3Key = s3Storage.Key;

  const purposeResult = UploadPurposeSchema.safeParse(rawPurpose);
  if (!purposeResult.success || !resourceId || !s3Key) {
    rootLogger.error(
      { rawPurpose, resourceId, s3Key, tusId: Upload.ID },
      "tusd post-finish: missing or invalid metadata",
    );
    return;
  }

  const cookieHeader = headerValue(body.Event.HTTPRequest.Header, "Cookie");
  const authHeader = headerValue(body.Event.HTTPRequest.Header, "Authorization");

  const headers = new Headers();
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  if (authHeader) headers.set("Authorization", authHeader);

  const session = await auth.api.getSession({ headers });
  if (!session) {
    rootLogger.error({ tusId: Upload.ID }, "tusd post-finish: invalid session");
    return;
  }

  const hydrated = await hydrateAuthContext(session);

  await completeUploadFlow({
    body: { key: s3Key, purpose: purposeResult.data, resourceId },
    userId: hydrated.user.id,
    roles: hydrated.roles as string[],
    storage,
    logger: rootLogger,
    skipKeyValidation: true,
  });

  rootLogger.info(
    { tusId: Upload.ID, key: s3Key, purpose: purposeResult.data, resourceId },
    "tusd post-finish: upload recorded",
  );
}

function handlePostTerminate(body: TusdHookRequest): void {
  rootLogger.info(
    { tusId: body.Event.Upload.ID },
    "tusd post-terminate: upload terminated",
  );
}

// ── Public Routes ──

/**
 * tusd HTTP hook endpoint. Dispatches incoming webhook calls from the tusd
 * sidecar by hook type (pre-create, post-finish, post-terminate). Auth is
 * validated manually from forwarded Authorization/Cookie headers — this route
 * does not use requireAuth middleware.
 */
export const tusdHookRoutes = new Hono<AuthEnv>();

tusdHookRoutes.post("/hooks", async (c) => {
  const body = await c.req.json<TusdHookRequest>();
  const logger = c.var?.logger ?? rootLogger;

  switch (body.Type) {
    case "pre-create":
      return c.json(await handlePreCreate(body));
    case "post-finish":
      await handlePostFinish(body);
      return c.json({});
    case "post-terminate":
      handlePostTerminate(body);
      return c.json({});
    default:
      logger.warn({ hookType: body.Type }, "Unhandled tusd hook type");
      return c.json({});
  }
});
