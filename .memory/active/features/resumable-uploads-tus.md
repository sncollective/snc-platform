---
id: feature-resumable-uploads-tus
kind: feature
stage: implementing
tags: [content, media-pipeline]
release_binding: null
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Resumable Uploads via tus

tusd + `@uppy/tus`, dual-path (tus for large media, S3 presign for small files), hook-based completion, orphan cleanup.

## Sub-units

- [ ] Unit 1: tusd Docker Service
- [ ] Unit 2: tusd Hook Types (Shared Package)
- [ ] Unit 3: tusd Hook Route (API)
- [ ] Unit 4: Upload Context Migration (Web)
- [ ] Unit 5: Completion Flow Refactor
- [ ] Unit 6: Orphan Cleanup Job

## Overview

Large video uploads (500 MB -- 2 GB+) are lost if the user refreshes the page because the S3 multipart upload state (`uploadId`, completed parts) lives only in Uppy's in-memory state. This design introduces [tusd](https://github.com/tus/tusd) as a tus protocol server between Uppy and Garage, enabling cross-session resumable uploads.

**Architecture change:** For large media uploads (`content-media`, `playout-media`), the client talks to tusd via `@uppy/tus` instead of `@uppy/aws-s3`. tusd manages the S3 multipart lifecycle and stores upload URLs in the browser's localStorage via tus-js-client fingerprinting. Small files (thumbnails, avatars, banners) stay on the existing direct S3 presign path -- they complete in seconds and don't benefit from resumability.

**Completion flow change:** Instead of the client calling `POST /api/uploads/complete` with an S3 key after upload, tusd's `post-finish` hook calls the API server directly. The API extracts the S3 key from the hook payload and runs the same completion logic (DB record, job queue). The client no longer needs to know the S3 key for tus uploads.

**New services:** `snc-tusd` Docker container with S3 backend pointing at `snc-garage`. HTTP hooks forward the `Authorization` header to the API for auth validation.

---

## Implementation Units

### Unit 1: tusd Docker Service

**Files**:
- `platform/docker-compose.yml` (modify)
- `platform/docker-compose.claude.yml` (modify)

Add `snc-tusd` service with Garage S3 backend and HTTP hooks pointing at the API server.

**docker-compose.yml addition:**

```yaml
  snc-tusd:
    image: tusproject/tusd:latest
    container_name: snc-tusd
    ports:
      - "8070:8080"
    environment:
      AWS_ACCESS_KEY_ID: ${S3_ACCESS_KEY_ID:-}
      AWS_SECRET_ACCESS_KEY: ${S3_SECRET_ACCESS_KEY:-}
      AWS_REGION: garage
    command:
      - -s3-bucket=${S3_BUCKET:-snc-uploads}
      - -s3-endpoint=http://snc-garage:3900
      - -s3-object-prefix=tus/
      - -behind-proxy
      - -hooks-http=http://host.docker.internal:3000/api/tusd/hooks
      - -hooks-http-forward-headers=Authorization,Cookie
      - -hooks-http-retry=3
      - -hooks-http-backoff=2
      - -hooks-enabled-events=pre-create,post-finish,post-terminate
      - -cors-allow-origin=https?://localhost(:\d+)?
      - -max-size=21474836480
    depends_on:
      snc-garage:
        condition: service_healthy
    tmpfs:
      - /tmp:size=256M
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/files/"]
      interval: 10s
      timeout: 5s
      retries: 3
```

**docker-compose.claude.yml addition:**

```yaml
  snc-tusd:
    networks:
      - claude-net
```

**Implementation Notes**:

- `-s3-object-prefix=tus/` keeps tusd-managed objects in a `tus/` prefix separate from direct S3 uploads. The `post-finish` hook will move/rename the key into the canonical path via the completion flow's `generateKey` logic. See Unit 5 for how the final S3 key is derived.
- `-max-size=21474836480` (20 GiB) matches `MAX_FILE_SIZES.video` from `@snc/shared`.
- `-hooks-http=http://host.docker.internal:3000/api/tusd/hooks` targets the API server running on the host (PM2 dev server). In production, this becomes the internal Docker network hostname.
- `-hooks-http-forward-headers=Authorization,Cookie` forwards auth headers so the API can validate the session in `pre-create`. Cookie is included because Better Auth uses cookie-based sessions.
- `-behind-proxy` is required because tusd sits behind the Vite dev proxy (dev) and Caddy (production).
- `tmpfs` at `/tmp` provides scratch space for tusd's disk buffer during S3 uploads. tusd buffers up to one S3 part size (default 50 MiB) before flushing to S3.
- `depends_on` with `service_healthy` ensures Garage is ready before tusd tries to connect.
- The dev proxy in the web app (`vite.config.ts`) will need a `/uploads/` route added to forward to `http://localhost:8070/files/`. This is a minor config change, not a separate unit.

**Acceptance Criteria**:

- [ ] `docker compose up snc-tusd` starts successfully
- [ ] `wget --spider http://localhost:8070/files/` returns 200
- [ ] tusd can reach Garage (upload a test file via curl and confirm it lands in the S3 bucket under `tus/`)
- [ ] Hook requests arrive at the API server (visible in pm2 logs)

---

### Unit 2: tusd Hook Types (Shared Package)

**File**: `packages/shared/src/tusd.ts` (new)

```typescript
// ── Public Types ──

/** Hook event types enabled in the tusd configuration. */
export type TusdHookType =
  | "pre-create"
  | "post-create"
  | "post-receive"
  | "pre-finish"
  | "post-finish"
  | "pre-terminate"
  | "post-terminate";

/** Top-level hook request body sent by tusd to the HTTP hook endpoint. */
export interface TusdHookRequest {
  readonly Type: TusdHookType;
  readonly Event: TusdHookEvent;
}

export interface TusdHookEvent {
  readonly Upload: TusdUpload;
  readonly HTTPRequest: TusdHTTPRequest;
}

export interface TusdUpload {
  /** Unique upload identifier (URI-safe string). */
  readonly ID: string;
  /** Total upload size in bytes. 0 if deferred. */
  readonly Size: number;
  /** True if size was not known at creation time. */
  readonly SizeIsDeferred: boolean;
  /** Number of bytes received so far. */
  readonly Offset: number;
  /**
   * Client-defined metadata from the Upload-Metadata header.
   * Uppy maps `name` to `filename` and `type` to `filetype` automatically.
   * Custom fields: `purpose`, `resourceId`.
   */
  readonly MetaData: Record<string, string>;
  /** True if this is a partial upload (concatenation extension). */
  readonly IsPartial: boolean;
  /** True if this is a final concatenated upload. */
  readonly IsFinal: boolean;
  /** Upload IDs of partial uploads (if IsFinal is true). */
  readonly PartialUploads: readonly string[] | null;
  /** Backend-specific storage details. */
  readonly Storage: TusdStorageS3 | TusdStorageFile;
}

/** Storage details when tusd uses the S3 backend. */
export interface TusdStorageS3 {
  readonly Type: "s3store";
  readonly Bucket: string;
  readonly Key: string;
}

/** Storage details when tusd uses the local filestore backend. */
export interface TusdStorageFile {
  readonly Type: "filestore";
  readonly Path: string;
  readonly InfoPath: string;
}

export interface TusdHTTPRequest {
  readonly Method: string;
  readonly URI: string;
  readonly RemoteAddr: string;
  /**
   * HTTP headers from the original client request.
   * Values are string arrays (HTTP allows repeated headers).
   * Only includes headers listed in `-hooks-http-forward-headers`.
   */
  readonly Header: Record<string, readonly string[]>;
}

/**
 * Response body returned to tusd from the hook endpoint.
 * All fields are optional. Only include what you need.
 */
export interface TusdHookResponse {
  /** Override the HTTP response sent to the tus client. */
  readonly HTTPResponse?: TusdHTTPResponse;
  /** Reject the upload (pre-create only). */
  readonly RejectUpload?: boolean;
  /** Modify upload info before creation (pre-create only). */
  readonly ChangeFileInfo?: TusdChangeFileInfo;
}

export interface TusdHTTPResponse {
  readonly StatusCode: number;
  readonly Body: string;
  readonly Header: Record<string, string>;
}

export interface TusdChangeFileInfo {
  /** Override or add metadata. */
  readonly MetaData?: Record<string, string>;
}
```

**Re-export** from `packages/shared/src/index.ts`:

```typescript
export * from "./tusd.js";
```

**Implementation Notes**:

- Types match the JSON schema tusd sends to HTTP hook endpoints. Field names use PascalCase to match tusd's Go JSON serialization.
- `TusdHookResponse` is scoped to the fields we actually use. `RejectTermination` and `StopUpload` are omitted because we don't handle `pre-terminate` or `post-receive` hooks.
- `readonly` on all fields follows the codebase convention for shared types.
- `TusdStorageFile` is included for completeness but will not appear in production (S3 backend only).

**Acceptance Criteria**:

- [ ] Types exported from `@snc/shared`
- [ ] `bun run --filter @snc/shared build` succeeds
- [ ] No runtime dependencies added (types only)

---

### Unit 3: tusd Hook Route (API)

**File**: `apps/api/src/routes/tusd-hooks.routes.ts` (new)

```typescript
import { Hono } from "hono";

import {
  UnauthorizedError,
  ValidationError,
  UploadPurposeSchema,
} from "@snc/shared";
import type {
  TusdHookRequest,
  TusdHookResponse,
  TusdStorageS3,
  UploadPurpose,
} from "@snc/shared";

import type { AuthEnv } from "../middleware/auth-env.js";
import { auth } from "../auth/auth.js";
import { completeUploadFlow } from "../services/upload-completion.js";
import { storage } from "../storage/index.js";
import { rootLogger } from "../logging/logger.js";

// ── Private Constants ──

/** Upload purposes routed through tus (large media files). */
const TUS_PURPOSES: ReadonlySet<UploadPurpose> = new Set([
  "content-media",
  "playout-media",
]);

// ── Private Helpers ──

/**
 * Validate the tusd pre-create hook: authenticate the user, verify the
 * upload purpose is allowed via tus, and check resource ownership.
 *
 * @returns Empty response to allow the upload, or a rejection response.
 */
async function handlePreCreate(
  body: TusdHookRequest,
): Promise<TusdHookResponse> {
  // Extract forwarded auth headers
  const cookieHeader = body.Event.HTTPRequest.Header["Cookie"]?.[0]
    ?? body.Event.HTTPRequest.Header["cookie"]?.[0];
  const authHeader = body.Event.HTTPRequest.Header["Authorization"]?.[0]
    ?? body.Event.HTTPRequest.Header["authorization"]?.[0];

  if (!cookieHeader && !authHeader) {
    return rejectUpload(401, "Missing authentication");
  }

  // Build a synthetic Headers object for Better Auth session validation
  const headers = new Headers();
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  if (authHeader) headers.set("Authorization", authHeader);

  const session = await auth.api.getSession({ headers });
  if (!session) {
    return rejectUpload(401, "Invalid session");
  }

  // Validate purpose metadata
  const rawPurpose = body.Event.Upload.MetaData.purpose;
  const purposeResult = UploadPurposeSchema.safeParse(rawPurpose);
  if (!purposeResult.success) {
    return rejectUpload(400, `Invalid upload purpose: ${rawPurpose ?? "missing"}`);
  }

  const purpose = purposeResult.data;
  if (!TUS_PURPOSES.has(purpose)) {
    return rejectUpload(400, `Purpose '${purpose}' is not allowed via tus`);
  }

  // Validate resourceId is present
  const resourceId = body.Event.Upload.MetaData.resourceId;
  if (!resourceId) {
    return rejectUpload(400, "Missing resourceId metadata");
  }

  // Ownership verification is delegated to completeUploadFlow (post-finish).
  // Pre-create only checks that the session is valid and metadata is well-formed.
  // This avoids duplicating the ownership logic and keeps pre-create fast.

  return {};
}

/**
 * Handle tusd post-finish hook: the upload is complete in S3.
 * Extract the S3 key and run the standard completion flow.
 */
async function handlePostFinish(
  body: TusdHookRequest,
): Promise<void> {
  const { Upload } = body.Event;
  const s3Storage = Upload.Storage as TusdStorageS3;

  if (s3Storage.Type !== "s3store") {
    rootLogger.error({ storageType: s3Storage.Type }, "Unexpected storage type in post-finish hook");
    return;
  }

  const purpose = Upload.MetaData.purpose as UploadPurpose;
  const resourceId = Upload.MetaData.resourceId;
  const s3Key = s3Storage.Key;

  if (!purpose || !resourceId || !s3Key) {
    rootLogger.error(
      { purpose, resourceId, s3Key, tusId: Upload.ID },
      "Missing metadata in post-finish hook",
    );
    return;
  }

  // Re-authenticate from forwarded headers to get userId/roles
  const cookieHeader = body.Event.HTTPRequest.Header["Cookie"]?.[0]
    ?? body.Event.HTTPRequest.Header["cookie"]?.[0];
  const authHeader = body.Event.HTTPRequest.Header["Authorization"]?.[0]
    ?? body.Event.HTTPRequest.Header["authorization"]?.[0];

  const headers = new Headers();
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  if (authHeader) headers.set("Authorization", authHeader);

  const session = await auth.api.getSession({ headers });
  if (!session) {
    rootLogger.error({ tusId: Upload.ID }, "post-finish hook: invalid session");
    return;
  }

  // Hydrate roles (same pattern as requireAuth middleware)
  const { hydrateAuthContext } = await import("../middleware/auth-helpers.js");
  const hydrated = await hydrateAuthContext(session);

  await completeUploadFlow({
    body: { key: s3Key, purpose, resourceId },
    userId: hydrated.user.id,
    roles: hydrated.roles,
    storage,
    logger: rootLogger,
  });

  rootLogger.info(
    { tusId: Upload.ID, key: s3Key, purpose, resourceId },
    "tusd post-finish: upload recorded",
  );
}

/**
 * Handle tusd post-terminate hook: the client or tusd deleted the upload.
 * Log the event. No DB cleanup needed because we only write DB records
 * in post-finish (after successful upload).
 */
async function handlePostTerminate(
  body: TusdHookRequest,
): Promise<void> {
  rootLogger.info(
    { tusId: body.Event.Upload.ID },
    "tusd post-terminate: upload terminated",
  );
}

function rejectUpload(
  statusCode: number,
  message: string,
): TusdHookResponse {
  return {
    RejectUpload: true,
    HTTPResponse: {
      StatusCode: statusCode,
      Body: JSON.stringify({ error: { code: "UPLOAD_REJECTED", message } }),
      Header: { "Content-Type": "application/json" },
    },
  };
}

// ── Public Routes ──

/** tusd HTTP hook endpoint. Dispatches by hook type. */
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
      await handlePostTerminate(body);
      return c.json({});

    default:
      logger.warn({ hookType: body.Type }, "Unhandled tusd hook type");
      return c.json({});
  }
});
```

**Mount in `apps/api/src/app.ts`:**

```typescript
import { tusdHookRoutes } from "./routes/tusd-hooks.routes.js";

// Mount alongside other always-on routes
app.route("/api/tusd", tusdHookRoutes);
```

**Implementation Notes**:

- The hook route does **not** use `requireAuth` middleware. tusd makes server-to-server HTTP calls that carry forwarded headers but are not browser requests. Auth is validated manually inside `handlePreCreate` and `handlePostFinish` by calling `auth.api.getSession()` with the forwarded headers.
- `pre-create` validates the session and metadata format but does **not** verify resource ownership. Ownership is checked in `completeUploadFlow` during `post-finish`. This keeps `pre-create` fast (it's blocking -- tusd waits for the response before accepting the upload).
- `post-finish` is non-blocking from tusd's perspective (tusd has already committed the file to S3). Errors are logged but don't propagate to the client.
- `post-terminate` is informational only. Since DB records are only created in `post-finish`, a terminated upload leaves no orphan records.
- The `TUS_PURPOSES` set enforces that only `content-media` and `playout-media` are allowed through tus. Thumbnails, avatars, and banners are rejected at `pre-create` if someone tries to route them through tusd.
- No rate limiter on the hook endpoint because only tusd calls it (server-to-server on the Docker network). If exposed externally in the future, add one.

**Acceptance Criteria**:

- [ ] `POST /api/tusd/hooks` with `Type: "pre-create"` and valid session returns `{}`
- [ ] `POST /api/tusd/hooks` with `Type: "pre-create"` and no auth returns `{ RejectUpload: true }` with 401
- [ ] `POST /api/tusd/hooks` with `Type: "pre-create"` and `purpose: "creator-avatar"` returns rejection (wrong purpose for tus)
- [ ] `POST /api/tusd/hooks` with `Type: "post-finish"` triggers `completeUploadFlow` and queues processing job
- [ ] `POST /api/tusd/hooks` with unknown type returns `{}` and logs warning
- [ ] Route mounted at `/api/tusd/hooks` in `app.ts`

---

### Unit 4: Upload Context Migration (Web)

**File**: `apps/web/src/contexts/upload-context.tsx` (modify)

**Package changes**:
- Install: `@uppy/tus`
- Remove: `@uppy/aws-s3` (after migration)

**Key changes to `upload-context.tsx`:**

```typescript
// ── Import changes ──

// Remove:
import AwsS3 from "@uppy/aws-s3";
import { MULTIPART_THRESHOLD, MULTIPART_CHUNK_SIZE } from "@snc/shared";
import {
  presignUpload,
  createMultipartUpload,
  signPart,
  completeMultipartUpload,
  abortMultipartUpload,
  listParts,
  completeUpload,
  retryWithBackoff,
} from "../lib/uploads.js";

// Add:
import Tus from "@uppy/tus";
import {
  presignUpload,
  completeUpload,
  retryWithBackoff,
} from "../lib/uploads.js";

// ── New constant ──

/** Upload purposes routed through tus (large media files). */
const TUS_UPLOAD_PURPOSES: ReadonlySet<string> = new Set([
  "content-media",
  "playout-media",
]);

/** Endpoint for tus uploads (proxied to tusd via Vite dev proxy / Caddy). */
const TUS_ENDPOINT = "/uploads/";
```

**Dual Uppy instance approach:** Rather than a single Uppy instance that switches behavior per file, use two Uppy instances -- one with `@uppy/tus` for large media, one with `@uppy/aws-s3` for small files. This keeps the plugin configuration clean and avoids conditional plugin switching at runtime.

```typescript
// ── Lazy Uppy initialization (replace existing block) ──

// tus Uppy instance for large media uploads
const tusUppyRef = useRef<Uppy | null>(null);
// S3 Uppy instance for small file uploads (thumbnails, avatars, banners)
const s3UppyRef = useRef<Uppy | null>(null);

if (!tusUppyRef.current) {
  tusUppyRef.current = new Uppy({ autoProceed: true }).use(Tus, {
    endpoint: TUS_ENDPOINT,
    retryDelays: [100, 1000, 3000, 5000],
    removeFingerprintOnSuccess: true,
    allowedMetaFields: ["purpose", "resourceId"],
    chunkSize: MULTIPART_CHUNK_SIZE,
    async onBeforeRequest(req) {
      // Better Auth uses cookie auth; cookies are sent automatically.
      // No explicit Authorization header needed for same-origin requests.
      // If the proxy or tusd strips cookies, add bearer token logic here.
    },
  });
}

if (!s3UppyRef.current) {
  s3UppyRef.current = new Uppy({ autoProceed: true }).use(AwsS3, {
    shouldUseMultipart: (file) => (file.size ?? 0) > MULTIPART_THRESHOLD,
    getChunkSize: () => MULTIPART_CHUNK_SIZE,
    // ... existing AwsS3 config unchanged ...
  });
}
```

**Event wiring for tus Uppy instance:**

```typescript
// tus upload-success handler
const onTusSuccess = (
  file: UppyFile<Meta, Body> | undefined,
  response: NonNullable<UppyFile<Meta, Body>["response"]>,
) => {
  const fileId = file?.id;
  if (!fileId) return;

  // For tus uploads, completion is handled server-side by the post-finish hook.
  // The client just needs to update its own UI state.
  dispatch({ type: "SET_STATUS", id: fileId, status: "complete" });
  callbacksRef.current.get(fileId)?.onComplete?.("");
  callbacksRef.current.delete(fileId);
};
```

**Routing logic in `startUpload`:**

```typescript
startUpload: (options: StartUploadOptions) => {
  const { file, purpose, resourceId, onComplete, onError } = options;

  const doUpload = async () => {
    const s3 = await probeS3Availability(s3AvailableRef, {
      purpose, resourceId, filename: file.name,
      contentType: file.type, size: file.size,
    });

    if (!s3) {
      // Legacy fallback (unchanged)
      // ...
      return;
    }

    if (TUS_UPLOAD_PURPOSES.has(purpose)) {
      // tus path for large media
      const uppy = tusUppyRef.current;
      if (!uppy) return;
      const fileId = uppy.addFile({
        name: file.name,
        type: file.type,
        data: file,
        meta: { purpose, resourceId },
      });
      callbacksRef.current.set(fileId, { onComplete, onError });
      dispatch({ type: "ADD_UPLOAD", id: fileId, filename: file.name });
    } else {
      // S3 presign path for small files (thumbnails, avatars, banners)
      const uppy = s3UppyRef.current;
      if (!uppy) return;
      const fileId = uppy.addFile({
        name: file.name,
        type: file.type,
        data: file,
        meta: { purpose, resourceId },
      });
      callbacksRef.current.set(fileId, { onComplete, onError });
      dispatch({ type: "ADD_UPLOAD", id: fileId, filename: file.name });
    }
  };

  doUpload().catch((err) => {
    const error = err instanceof Error ? err : new Error("Upload failed");
    onError?.(error);
  });
},
```

**Vite dev proxy addition** (`apps/web/vite.config.ts`):

```typescript
proxy: {
  // ... existing proxies ...
  "/uploads": {
    target: "http://localhost:8070",
    rewrite: (path) => path.replace(/^\/uploads/, "/files"),
  },
},
```

**Implementation Notes**:

- Two Uppy instances avoids the complexity of per-file plugin switching. Each instance has its own event wiring but shares the same `dispatch` and `callbacksRef`.
- `storeFingerprintForResuming` defaults to `true` in `@uppy/tus`, enabling cross-session resume automatically. When the user re-drops the same file, tus-js-client finds the stored upload URL in localStorage, issues a `HEAD` to check the offset, and resumes from where it left off.
- `removeFingerprintOnSuccess: true` cleans up localStorage entries after successful uploads to prevent stale entries.
- `chunkSize` matches `MULTIPART_CHUNK_SIZE` (50 MiB) for optimal throughput with tusd's S3 part size.
- The tus `upload-success` handler does **not** call `POST /api/uploads/complete`. Completion is handled server-side by the `post-finish` hook. The client only updates its local UI state.
- The S3 `upload-success` handler continues to call `POST /api/uploads/complete` as before.
- `cancelUpload` and `cancelAll` need to check both Uppy instances (route by file ID prefix or maintain a map).
- The `beforeunload` guard applies to both instances.
- Cleanup on unmount destroys both instances.

**Acceptance Criteria**:

- [ ] `content-media` uploads route through tus and appear in Garage under the `tus/` prefix
- [ ] `content-thumbnail` uploads route through S3 presign (existing path)
- [ ] Progress events fire for tus uploads
- [ ] Refreshing the page mid-upload and re-dropping the same file resumes from the last offset
- [ ] Completed tus uploads trigger processing (visible in pg-boss jobs)
- [ ] S3 presign uploads still call `POST /api/uploads/complete` and work as before
- [ ] `beforeunload` guard fires for both tus and S3 uploads

---

### Unit 5: Completion Flow Refactor

**File**: `apps/api/src/services/upload-completion.ts` (new, extracted from `upload.routes.ts`)

Extract the `completeUploadFlow` function and its private helpers from `upload.routes.ts` into a dedicated service module. Both the existing `POST /api/uploads/complete` route and the tusd `post-finish` hook call the same service.

```typescript
import { eq } from "drizzle-orm";

import {
  AppError,
  ValidationError,
  MAX_FILE_SIZES,
} from "@snc/shared";
import type { UploadPurpose, StorageProvider, CompleteUploadRequest } from "@snc/shared";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { playoutItems } from "../db/schema/playout.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { getBoss } from "../jobs/boss.js";
import { JOB_QUEUES } from "../jobs/register-workers.js";
import { requireCreatorPermission } from "../services/creator-team.js";

// ── Private Constants ──

const PURPOSE_CATEGORY: Record<UploadPurpose, string> = {
  "content-media": "media",
  "content-thumbnail": "image",
  "creator-avatar": "image",
  "creator-banner": "image",
  "playout-media": "video",
};

const PURPOSE_KEY_PREFIX: Record<UploadPurpose, string> = {
  "content-media": "content",
  "content-thumbnail": "content",
  "creator-avatar": "creators",
  "creator-banner": "creators",
  "playout-media": "playout",
};

const PURPOSE_FIELD: Record<UploadPurpose, string> = {
  "content-media": "media",
  "content-thumbnail": "thumbnail",
  "creator-avatar": "avatar",
  "creator-banner": "banner",
  "playout-media": "source",
};

const RECORD_UPLOAD_DISPATCH: Record<UploadPurpose, (resourceId: string, key: string) => Promise<void>> = {
  "content-media": async (resourceId, key) => {
    await db.update(content).set({ mediaKey: key, updatedAt: new Date() }).where(eq(content.id, resourceId));
  },
  "content-thumbnail": async (resourceId, key) => {
    await db.update(content).set({ thumbnailKey: key, updatedAt: new Date() }).where(eq(content.id, resourceId));
  },
  "creator-avatar": async (resourceId, key) => {
    await db.update(creatorProfiles).set({ avatarKey: key, updatedAt: new Date() }).where(eq(creatorProfiles.id, resourceId));
  },
  "creator-banner": async (resourceId, key) => {
    await db.update(creatorProfiles).set({ bannerKey: key, updatedAt: new Date() }).where(eq(creatorProfiles.id, resourceId));
  },
  "playout-media": async (resourceId, key) => {
    await db.update(playoutItems).set({ sourceKey: key, updatedAt: new Date() }).where(eq(playoutItems.id, resourceId));
  },
};

// ── Private Helpers ──

const verifyOwnership = async (
  purpose: UploadPurpose,
  resourceId: string,
  userId: string,
  roles?: string[],
): Promise<void> => {
  if (purpose === "playout-media") {
    if (!roles?.includes("admin")) {
      throw new AppError("UNAUTHORIZED", "Admin role required for playout uploads", 401);
    }
    return;
  }

  if (purpose.startsWith("content-")) {
    const [row] = await db
      .select({ creatorId: content.creatorId })
      .from(content)
      .where(eq(content.id, resourceId))
      .limit(1);
    if (!row) throw new AppError("NOT_FOUND", "Content not found", 404);
    await requireCreatorPermission(userId, row.creatorId, "manageContent", roles);
    return;
  }

  if (purpose.startsWith("creator-")) {
    await requireCreatorPermission(userId, resourceId, "editProfile", roles);
    return;
  }

  throw new ValidationError("Invalid purpose");
};

const recordUpload = async (
  purpose: UploadPurpose,
  resourceId: string,
  key: string,
): Promise<void> => {
  await RECORD_UPLOAD_DISPATCH[purpose](resourceId, key);
};

// ── Public API ──

export interface CompleteUploadFlowParams {
  readonly body: CompleteUploadRequest;
  readonly userId: string;
  readonly roles: string[];
  readonly storage: StorageProvider;
  readonly logger: { warn: (obj: object, msg: string) => void };
  /**
   * When true, skip key prefix validation. Used for tusd uploads where the
   * S3 key is under the `tus/` prefix rather than the canonical path.
   */
  readonly skipKeyValidation?: boolean;
}

/**
 * Execute the full post-upload flow: validate key, verify ownership, HEAD-check size,
 * clean up old storage keys, record the upload in the DB, and queue processing jobs.
 *
 * Called by both the direct S3 upload completion route and the tusd post-finish hook.
 *
 * @throws {ValidationError} When the key prefix is wrong, the file is missing, or it exceeds size limits.
 * @throws {AppError} When the caller lacks the required role or ownership.
 */
export async function completeUploadFlow(params: CompleteUploadFlowParams): Promise<{ key: string }> {
  const { body, userId, roles, storage, logger, skipKeyValidation } = params;

  if (!skipKeyValidation) {
    const expectedPrefix = `${PURPOSE_KEY_PREFIX[body.purpose]}/${body.resourceId}/${PURPOSE_FIELD[body.purpose]}/`;
    if (!body.key.startsWith(expectedPrefix)) {
      throw new ValidationError("Key does not match the expected upload path");
    }
  }

  await verifyOwnership(body.purpose, body.resourceId, userId, roles);

  const purposeCategory = PURPOSE_CATEGORY[body.purpose];

  const headResult = await storage.head(body.key);
  if (!headResult.ok) {
    throw new ValidationError("File not found in storage -- upload may have failed");
  }
  const maxSize = MAX_FILE_SIZES[purposeCategory as keyof typeof MAX_FILE_SIZES];
  if (headResult.value.size > maxSize) {
    await storage.delete(body.key);
    throw new ValidationError("Uploaded file exceeds size limit");
  }

  if (body.purpose.startsWith("content-")) {
    const [existing] = await db
      .select({ mediaKey: content.mediaKey, thumbnailKey: content.thumbnailKey })
      .from(content)
      .where(eq(content.id, body.resourceId))
      .limit(1);
    const oldKey =
      body.purpose === "content-media"
        ? (existing?.mediaKey ?? null)
        : (existing?.thumbnailKey ?? null);
    if (oldKey && oldKey !== body.key) {
      const deleteResult = await storage.delete(oldKey);
      if (!deleteResult.ok) {
        logger.warn({ error: deleteResult.error.message, key: oldKey }, "Failed to delete old file");
      }
    }
  }

  await recordUpload(body.purpose, body.resourceId, body.key);

  if (body.purpose === "content-media") {
    await db
      .update(content)
      .set({ processingStatus: "processing", updatedAt: new Date() })
      .where(eq(content.id, body.resourceId));

    const boss = getBoss();
    if (boss) {
      await boss.send(JOB_QUEUES.PROBE_CODEC, { contentId: body.resourceId });
    }
  }

  if (body.purpose === "playout-media") {
    await db
      .update(playoutItems)
      .set({ processingStatus: "uploading", updatedAt: new Date() })
      .where(eq(playoutItems.id, body.resourceId));

    const boss = getBoss();
    if (boss) {
      await boss.send(JOB_QUEUES.PLAYOUT_INGEST, { playoutItemId: body.resourceId });
    }
  }

  return { key: body.key };
}

// Re-export constants needed by upload.routes.ts
export { PURPOSE_KEY_PREFIX, PURPOSE_FIELD, PURPOSE_CATEGORY, verifyOwnership };
```

**Changes to `apps/api/src/routes/upload.routes.ts`:**

- Remove `completeUploadFlow`, `verifyOwnership`, `recordUpload`, `RECORD_UPLOAD_DISPATCH`, `PURPOSE_CATEGORY`, `PURPOSE_KEY_PREFIX`, `PURPOSE_FIELD` (moved to service).
- Import `completeUploadFlow` and `verifyOwnership` from `../services/upload-completion.js`.
- Import `PURPOSE_KEY_PREFIX`, `PURPOSE_FIELD` for `generateKey` (still used by presign/multipart routes).
- The `POST /complete` route handler calls `completeUploadFlow` exactly as before, just from the new import path.

**Implementation Notes**:

- `skipKeyValidation` is used by the tusd `post-finish` hook. tusd stores files under the `tus/` prefix with its own naming scheme (upload ID-based), so the key won't match the canonical `content/{id}/media/{filename}` pattern. The key validation is only meaningful for direct S3 uploads where the client controls the key.
- All private helpers (`verifyOwnership`, `recordUpload`, etc.) move to the service module. The route file becomes a thin handler.
- This follows the `thin-handlers-fat-services` pattern from the codebase conventions.
- The service module uses the same error types (`ValidationError`, `AppError`) for consistent error handling.

**Acceptance Criteria**:

- [ ] `POST /api/uploads/complete` works identically to before (regression test)
- [ ] `completeUploadFlow` is importable from `services/upload-completion.js`
- [ ] tusd `post-finish` hook can call `completeUploadFlow` with `skipKeyValidation: true`
- [ ] All existing upload tests pass without modification
- [ ] `bun run --filter @snc/api build` succeeds

---

### Unit 6: Orphan Cleanup Job

**Files**:
- `apps/api/src/jobs/handlers/cleanup-incomplete-uploads.ts` (new)
- `apps/api/src/jobs/register-workers.ts` (modify)

Garage does not have S3 lifecycle policies to automatically expire incomplete multipart uploads. tusd-initiated uploads that are abandoned (browser closed, network failure with no resume) leave orphan multipart uploads consuming storage. This job cleans them up daily.

```typescript
// apps/api/src/jobs/handlers/cleanup-incomplete-uploads.ts

import type { Job } from "pg-boss";

import { rootLogger } from "../../logging/logger.js";
import { config } from "../../config.js";

// ── Public Types ──

export interface CleanupIncompleteUploadsJobData {
  /** Age threshold in seconds. Uploads older than this are cleaned up. */
  readonly olderThanSecs: number;
}

// ── Private Constants ──

const GARAGE_ADMIN_URL = "http://snc-garage:3903";
const GARAGE_ADMIN_TOKEN = "dev-admin-token"; // TODO: move to config for production

// ── Public API ──

/**
 * Clean up incomplete multipart uploads in Garage that are older than the
 * configured threshold. Calls Garage's Admin API endpoint.
 *
 * Fallback: if the Garage Admin API is unavailable, uses S3 ListMultipartUploads
 * + AbortMultipartUpload via the existing S3 client.
 */
export async function handleCleanupIncompleteUploads(
  jobs: [Job<CleanupIncompleteUploadsJobData>],
): Promise<void> {
  const [job] = jobs;
  const { olderThanSecs } = job.data;
  const logger = rootLogger.child({ job: "cleanup-incomplete-uploads" });

  try {
    // Preferred path: Garage Admin API
    const response = await fetch(
      `${GARAGE_ADMIN_URL}/v2/CleanupIncompleteUploads`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GARAGE_ADMIN_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ olderThanSecs }),
      },
    );

    if (response.ok) {
      const result = await response.json() as { uploadsCleaned?: number };
      logger.info(
        { uploadsCleaned: result.uploadsCleaned ?? 0, olderThanSecs },
        "Incomplete multipart uploads cleaned up via Garage Admin API",
      );
      return;
    }

    logger.warn(
      { status: response.status, statusText: response.statusText },
      "Garage Admin API cleanup failed, falling back to S3 API",
    );
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      "Garage Admin API unreachable, falling back to S3 API",
    );
  }

  // Fallback: S3 ListMultipartUploads + AbortMultipartUpload
  await cleanupViaS3Api(olderThanSecs, logger);
}

async function cleanupViaS3Api(
  olderThanSecs: number,
  logger: typeof rootLogger,
): Promise<void> {
  const { ListMultipartUploadsCommand, AbortMultipartUploadCommand } = await import("@aws-sdk/client-s3");
  const { s3Client, s3Bucket } = await import("../../storage/index.js");

  if (!s3Client || !s3Bucket) {
    logger.warn("S3 not configured, skipping cleanup");
    return;
  }

  const cutoff = new Date(Date.now() - olderThanSecs * 1000);
  let cleaned = 0;

  const listResponse = await s3Client.send(
    new ListMultipartUploadsCommand({ Bucket: s3Bucket }),
  );

  for (const upload of listResponse.Uploads ?? []) {
    if (upload.Initiated && upload.Initiated < cutoff && upload.UploadId && upload.Key) {
      await s3Client.send(
        new AbortMultipartUploadCommand({
          Bucket: s3Bucket,
          Key: upload.Key,
          UploadId: upload.UploadId,
        }),
      );
      cleaned++;
      logger.debug(
        { key: upload.Key, uploadId: upload.UploadId, initiated: upload.Initiated.toISOString() },
        "Aborted incomplete multipart upload",
      );
    }
  }

  logger.info({ cleaned, olderThanSecs }, "Incomplete multipart uploads cleaned up via S3 API");
}
```

**Changes to `apps/api/src/jobs/register-workers.ts`:**

```typescript
// New import
import { handleCleanupIncompleteUploads } from "./handlers/cleanup-incomplete-uploads.js";
import type { CleanupIncompleteUploadsJobData } from "./handlers/cleanup-incomplete-uploads.js";

// Add to JOB_QUEUES
export const JOB_QUEUES = {
  // ... existing queues ...
  CLEANUP_INCOMPLETE_UPLOADS: "storage/cleanup-incomplete-uploads",
} as const;

// In registerWorkers():
await boss.createQueue(JOB_QUEUES.CLEANUP_INCOMPLETE_UPLOADS, {
  retryLimit: 2,
  expireInSeconds: 300,
  deleteAfterSeconds: 60 * 60 * 24 * 7,
});

await boss.work<CleanupIncompleteUploadsJobData>(
  JOB_QUEUES.CLEANUP_INCOMPLETE_UPLOADS,
  { localConcurrency: 1 },
  (jobs) => handleCleanupIncompleteUploads(jobs as [Job<CleanupIncompleteUploadsJobData>]),
);

// Schedule daily run (pg-boss cron)
await boss.schedule(
  JOB_QUEUES.CLEANUP_INCOMPLETE_UPLOADS,
  "0 3 * * *", // 3 AM daily
  { olderThanSecs: 86400 }, // 24 hours
);
```

**Implementation Notes**:

- The Garage Admin API endpoint `POST /v2/CleanupIncompleteUploads` is the preferred path because it's a single call that handles all buckets. The Garage admin port (3903) is accessible on the Docker network.
- The S3 API fallback (`ListMultipartUploads` + `AbortMultipartUpload`) is a safety net in case the Garage Admin API changes or is unavailable. It only checks one bucket at a time.
- `olderThanSecs: 86400` (24 hours) is conservative -- an upload that hasn't progressed in 24 hours is almost certainly abandoned. Users who pause a multi-day upload would need to restart (but the tus fingerprint means they'd still resume from where they left off if the upload isn't cleaned up yet).
- `pg-boss.schedule()` uses cron syntax. `0 3 * * *` runs at 3 AM daily. pg-boss handles idempotency -- if the schedule already exists, it's a no-op.
- The `GARAGE_ADMIN_TOKEN` should be moved to `config.ts` for production. In dev, it matches the `admin_token` in `garage.toml`.

**Acceptance Criteria**:

- [ ] Job queue `storage/cleanup-incomplete-uploads` is created on startup
- [ ] Job runs on schedule (verify via `pg-boss` tables or trigger manually)
- [ ] Incomplete multipart uploads older than 24h are aborted
- [ ] Garage Admin API path works when Garage is available
- [ ] S3 API fallback works when Admin API is unavailable
- [ ] Job logs the number of cleaned uploads

---

## Implementation Order

```
Unit 2 (shared types)
  |
  v
Unit 5 (completion refactor) ── can run in parallel with ──> Unit 1 (Docker service)
  |                                                            |
  v                                                            v
Unit 3 (hook route) ─────────────────────────────────────> Unit 4 (web migration)
  |
  v
Unit 6 (orphan cleanup)
```

1. **Unit 2** first -- shared types are a dependency for everything else.
2. **Unit 5** next -- extract the completion service so both the existing route and the new hook route can use it. This is a pure refactor with no behavior change; existing tests validate it.
3. **Unit 1** and **Unit 5** can run in parallel -- Docker config is independent of TypeScript code.
4. **Unit 3** depends on Units 2 and 5 -- the hook route imports tusd types and calls the completion service.
5. **Unit 4** depends on Unit 1 (tusd must be running) and Unit 3 (hooks must be accepting requests).
6. **Unit 6** is independent of the upload flow and can be implemented at any point after Unit 1, but logically comes last as it's a maintenance concern.

---

## Testing

### Unit Tests

**Unit 2 (types):** No tests needed -- type-only module validated by build.

**Unit 3 (hook route):**

File: `apps/api/tests/routes/tusd-hooks.routes.test.ts`

- `describe("POST /api/tusd/hooks")`:
  - `describe("pre-create")`:
    - `it("rejects when no auth headers are forwarded")`
    - `it("rejects when session is invalid")`
    - `it("rejects when purpose is missing")`
    - `it("rejects when purpose is not allowed via tus (e.g. creator-avatar)")`
    - `it("rejects when resourceId is missing")`
    - `it("allows upload when session is valid and metadata is well-formed")`
  - `describe("post-finish")`:
    - `it("calls completeUploadFlow with S3 key from storage")`
    - `it("queues PROBE_CODEC job for content-media")`
    - `it("queues PLAYOUT_INGEST job for playout-media")`
    - `it("logs error and returns 200 when session is invalid")`
    - `it("logs error when metadata is missing")`
  - `describe("post-terminate")`:
    - `it("logs termination and returns 200")`
  - `describe("unknown hook type")`:
    - `it("returns empty response and logs warning")`

Use `hono-test-app-factory` pattern. Mock `auth.api.getSession`, `completeUploadFlow`, and `getBoss`.

**Unit 5 (completion service):**

File: `apps/api/tests/services/upload-completion.test.ts`

- `describe("completeUploadFlow")`:
  - `it("validates key prefix for direct S3 uploads")`
  - `it("skips key validation when skipKeyValidation is true")`
  - `it("verifies ownership via requireCreatorPermission")`
  - `it("HEAD-checks file size and rejects over-limit")`
  - `it("deletes old media key when replacing")`
  - `it("records upload in DB")`
  - `it("queues PROBE_CODEC for content-media")`
  - `it("queues PLAYOUT_INGEST for playout-media")`

This is largely a refactor -- existing tests in `upload.routes.test.ts` should continue to pass. Add targeted tests for the new `skipKeyValidation` parameter.

**Unit 6 (cleanup job):**

File: `apps/api/tests/jobs/handlers/cleanup-incomplete-uploads.test.ts`

- `describe("handleCleanupIncompleteUploads")`:
  - `it("calls Garage Admin API with correct parameters")`
  - `it("falls back to S3 API when Admin API is unavailable")`
  - `it("aborts only uploads older than threshold")`
  - `it("logs the number of cleaned uploads")`

Mock `fetch` for the Garage Admin API and `@aws-sdk/client-s3` for the fallback.

### Integration / Manual Tests

- Upload a 200 MB video via the web UI -- verify it routes through tus, appears in Garage, and triggers processing.
- Upload a thumbnail -- verify it routes through direct S3 presign (existing path).
- Start a 500 MB upload, refresh the page at 50%, re-drop the same file -- verify it resumes from ~50%.
- Start an upload, close the browser, reopen and re-drop -- verify cross-session resume.
- Upload with an expired/invalid session -- verify `pre-create` rejects with 401.
- Check `docker logs snc-tusd` for hook request/response logging.
- Trigger the cleanup job manually and verify it cleans up stale multipart uploads.

---

## Verification Checklist

- [ ] `snc-tusd` Docker service starts and passes healthcheck
- [ ] tusd can write to Garage (S3 connectivity verified)
- [ ] `@snc/shared` builds with new tusd types
- [ ] `POST /api/tusd/hooks` is mounted in `app.ts` and reachable
- [ ] `pre-create` hook validates auth and rejects invalid sessions
- [ ] `pre-create` hook rejects non-tus purposes (thumbnails, avatars, banners)
- [ ] `post-finish` hook triggers `completeUploadFlow` and queues processing
- [ ] `completeUploadFlow` extracted to service and called from both routes
- [ ] Existing `POST /api/uploads/complete` route works unchanged (regression)
- [ ] `@uppy/tus` installed in web app
- [ ] Large media uploads (content-media, playout-media) route through tus
- [ ] Small files (thumbnails, avatars, banners) route through direct S3 presign
- [ ] Cross-session resume works (page refresh mid-upload resumes)
- [ ] Progress indicator works for tus uploads
- [ ] `beforeunload` guard fires for tus uploads in progress
- [ ] Vite dev proxy forwards `/uploads/` to tusd
- [ ] Orphan cleanup job registered and scheduled (daily at 3 AM)
- [ ] Cleanup job successfully aborts stale multipart uploads
- [ ] All existing upload-related tests pass
- [ ] New tests cover hook route, completion service, and cleanup job
- [ ] `bun run --filter @snc/shared build && bun run --filter @snc/api build && bun run --filter @snc/web build` succeeds
