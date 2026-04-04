import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { eq } from "drizzle-orm";

import {
  AppError,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZES,
} from "@snc/shared";
import type { UploadPurpose, StorageProvider } from "@snc/shared";
import {
  PresignRequestSchema,
  PresignResponseSchema,
  CreateMultipartRequestSchema,
  CreateMultipartResponseSchema,
  SignPartResponseSchema,
  CompleteMultipartRequestSchema,
  CompleteUploadRequestSchema,
  ListPartsResponseSchema,
} from "@snc/shared";
import type {
  PresignRequest,
  CreateMultipartRequest,
  CompleteMultipartRequest,
  CompleteUploadRequest,
} from "@snc/shared";

import type { AuthEnv } from "../middleware/auth-env.js";
import { requireAuth } from "../middleware/require-auth.js";
import { storage, s3Multipart } from "../storage/index.js";
import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { playoutItems } from "../db/schema/playout.schema.js";
import { getBoss } from "../jobs/boss.js";
import { JOB_QUEUES } from "../jobs/register-workers.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import { sanitizeFilename } from "../lib/file-utils.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_503 } from "../lib/openapi-errors.js";
import { UploadIdParam, UploadPartParams } from "./route-params.js";

// ── Private Constants ──

const PRESIGN_EXPIRY_SECONDS: Record<UploadPurpose, number> = {
  "content-media": 3600,     // 1 hour — large files, multipart
  "content-thumbnail": 300,  // 5 min — small image
  "creator-avatar": 300,     // 5 min — small image
  "creator-banner": 300,     // 5 min — small image
  "playout-media": 3600,     // 1 hour — large files, multipart
};

const MULTIPART_PRESIGN_EXPIRY_SECONDS = 3600; // 1 hour — multipart parts always get full window

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

// ── Private Helpers ──

const requireS3 = (): void => {
  if (!s3Multipart) {
    throw new AppError(
      "S3_NOT_CONFIGURED",
      "Direct uploads require S3 storage backend",
      503,
    );
  }
};

const generateKey = (
  purpose: UploadPurpose,
  resourceId: string,
  filename: string,
): string => {
  const prefix = PURPOSE_KEY_PREFIX[purpose];
  const field = PURPOSE_FIELD[purpose];
  const sanitized = sanitizeFilename(filename);
  return `${prefix}/${resourceId}/${field}/${sanitized}`;
};

const validateUpload = (
  purpose: UploadPurpose,
  contentType: string,
  size: number,
  contentDbType?: string,
): void => {
  let acceptedTypes: readonly string[];
  let maxSize: number;

  if (purpose === "content-media" && contentDbType) {
    const typeKey = contentDbType as keyof typeof ACCEPTED_MIME_TYPES;
    acceptedTypes = ACCEPTED_MIME_TYPES[typeKey] ?? [];
    maxSize = MAX_FILE_SIZES[typeKey as keyof typeof MAX_FILE_SIZES] ?? 0;
  } else if (
    purpose === "content-thumbnail" ||
    purpose === "creator-avatar" ||
    purpose === "creator-banner"
  ) {
    acceptedTypes = ACCEPTED_MIME_TYPES.image;
    maxSize = MAX_FILE_SIZES.image;
  } else if (purpose === "playout-media") {
    acceptedTypes = ACCEPTED_MIME_TYPES.video;
    maxSize = MAX_FILE_SIZES.video;
  } else {
    throw new ValidationError("Unknown upload purpose");
  }

  if (!acceptedTypes.includes(contentType)) {
    throw new ValidationError(
      `Invalid MIME type '${contentType}'. Accepted: ${acceptedTypes.join(", ")}`,
    );
  }
  if (size > maxSize) {
    throw new ValidationError(
      `File size ${size} exceeds the ${maxSize} byte limit`,
    );
  }
};

const verifyOwnership = async (
  purpose: UploadPurpose,
  resourceId: string,
  userId: string,
  roles?: string[],
): Promise<{ contentType?: string }> => {
  if (purpose === "playout-media") {
    if (!roles?.includes("admin")) {
      throw new UnauthorizedError("Admin role required for playout uploads");
    }
    return {};
  }

  if (purpose.startsWith("content-")) {
    const [row] = await db
      .select({ creatorId: content.creatorId, type: content.type })
      .from(content)
      .where(eq(content.id, resourceId))
      .limit(1);
    if (!row) throw new NotFoundError("Content not found");

    await requireCreatorPermission(userId, row.creatorId, "manageContent", roles);
    return { contentType: row.type };
  }

  if (purpose.startsWith("creator-")) {
    await requireCreatorPermission(userId, resourceId, "editProfile", roles);
    return {};
  }

  throw new ValidationError("Invalid purpose");
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

const recordUpload = async (
  purpose: UploadPurpose,
  resourceId: string,
  key: string,
): Promise<void> => {
  await RECORD_UPLOAD_DISPATCH[purpose](resourceId, key);
};

/**
 * Execute the full post-upload flow: validate key, verify ownership, HEAD-check size,
 * clean up old storage keys, record the upload in the DB, and queue processing jobs.
 *
 * @throws {ValidationError} When the key prefix is wrong, the file is missing, or it exceeds size limits.
 * @throws {UnauthorizedError} When the caller lacks the required role or ownership.
 */
async function completeUploadFlow(params: {
  body: CompleteUploadRequest;
  userId: string;
  roles: string[];
  storage: StorageProvider;
  logger: { warn: (obj: object, msg: string) => void };
}): Promise<{ key: string }> {
  const { body, userId, roles, storage: storageProvider, logger } = params;

  const expectedPrefix = `${PURPOSE_KEY_PREFIX[body.purpose]}/${body.resourceId}/${PURPOSE_FIELD[body.purpose]}/`;
  if (!body.key.startsWith(expectedPrefix)) {
    throw new ValidationError("Key does not match the expected upload path");
  }

  await verifyOwnership(body.purpose, body.resourceId, userId, roles);

  const purposeCategory = PURPOSE_CATEGORY[body.purpose];

  const headResult = await storageProvider.head(body.key);
  if (!headResult.ok) {
    throw new ValidationError("File not found in storage — upload may have failed");
  }
  const maxSize = MAX_FILE_SIZES[purposeCategory as keyof typeof MAX_FILE_SIZES];
  if (headResult.value.size > maxSize) {
    await storageProvider.delete(body.key);
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
      const deleteResult = await storageProvider.delete(oldKey);
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

// ── Public Routes ──

/** Direct-to-storage and multipart upload lifecycle. */
export const uploadRoutes = new Hono<AuthEnv>();

// POST /presign — Get presigned PUT URL for single-file upload

uploadRoutes.post(
  "/presign",
  requireAuth,
  describeRoute({
    description: "Get a presigned PUT URL for direct-to-storage upload",
    tags: ["uploads"],
    responses: {
      200: {
        description: "Presigned URL generated",
        content: {
          "application/json": { schema: resolver(PresignResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      503: ERROR_503,
    },
  }),
  validator("json", PresignRequestSchema),
  async (c) => {
    requireS3();
    const body = c.req.valid("json" as never) as PresignRequest;
    const user = c.get("user");
    const roles = c.get("roles") ?? [];

    const { contentType } = await verifyOwnership(body.purpose, body.resourceId, user.id, roles);
    validateUpload(body.purpose, body.contentType, body.size, contentType);

    const key = generateKey(body.purpose, body.resourceId, body.filename);
    const result = await storage.getPresignedUploadUrl(
      key,
      body.contentType,
      PRESIGN_EXPIRY_SECONDS[body.purpose],
      body.size,
    );

    if (!result.ok) throw result.error;

    return c.json({ url: result.value, key, method: "PUT" as const });
  },
);

// POST /s3/multipart — Create multipart upload

uploadRoutes.post(
  "/s3/multipart",
  requireAuth,
  describeRoute({
    description: "Create an S3 multipart upload",
    tags: ["uploads"],
    responses: {
      200: {
        description: "Multipart upload created",
        content: {
          "application/json": { schema: resolver(CreateMultipartResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      503: ERROR_503,
    },
  }),
  validator("json", CreateMultipartRequestSchema),
  async (c) => {
    requireS3();
    const body = c.req.valid("json" as never) as CreateMultipartRequest;
    const user = c.get("user");
    const roles = c.get("roles") ?? [];

    const { contentType } = await verifyOwnership(body.purpose, body.resourceId, user.id, roles);
    validateUpload(body.purpose, body.contentType, body.size, contentType);

    const key = generateKey(body.purpose, body.resourceId, body.filename);
    const result = await s3Multipart!.createMultipartUpload(key, body.contentType);

    if (!result.ok) throw result.error;

    return c.json(result.value);
  },
);

// GET /s3/multipart/:uploadId/:partNumber — Sign a part for upload

uploadRoutes.get(
  "/s3/multipart/:uploadId/:partNumber",
  requireAuth,
  describeRoute({
    description: "Get a presigned URL for uploading a multipart part",
    tags: ["uploads"],
    responses: {
      200: {
        description: "Part signing URL",
        content: {
          "application/json": { schema: resolver(SignPartResponseSchema) },
        },
      },
      401: ERROR_401,
      503: ERROR_503,
    },
  }),
  validator("param", UploadPartParams),
  validator("query", z.object({ key: z.string().min(1) })),
  async (c) => {
    requireS3();
    const { uploadId, partNumber: partNumberStr } = c.req.valid("param" as never) as { uploadId: string; partNumber: string };
    const partNumber = parseInt(partNumberStr, 10);
    const { key } = c.req.valid("query" as never) as { key: string };

    if (Number.isNaN(partNumber) || partNumber < 1) {
      throw new ValidationError("Invalid part number");
    }

    const result = await s3Multipart!.signPart(
      uploadId,
      key,
      partNumber,
      MULTIPART_PRESIGN_EXPIRY_SECONDS,
    );

    if (!result.ok) throw result.error;

    return c.json({ url: result.value });
  },
);

// POST /s3/multipart/:uploadId/complete — Complete multipart upload

uploadRoutes.post(
  "/s3/multipart/:uploadId/complete",
  requireAuth,
  describeRoute({
    description: "Complete an S3 multipart upload",
    tags: ["uploads"],
    responses: {
      200: { description: "Multipart upload completed" },
      400: ERROR_400,
      401: ERROR_401,
      503: ERROR_503,
    },
  }),
  validator("param", UploadIdParam),
  validator("json", CompleteMultipartRequestSchema),
  async (c) => {
    requireS3();
    const { uploadId } = c.req.valid("param" as never) as { uploadId: string };
    const body = c.req.valid("json" as never) as CompleteMultipartRequest;

    const result = await s3Multipart!.completeMultipartUpload(
      uploadId,
      body.key,
      body.parts,
    );

    if (!result.ok) throw result.error;

    return c.json({ ok: true });
  },
);

// DELETE /s3/multipart/:uploadId — Abort multipart upload

uploadRoutes.delete(
  "/s3/multipart/:uploadId",
  requireAuth,
  describeRoute({
    description: "Abort an S3 multipart upload",
    tags: ["uploads"],
    responses: {
      200: { description: "Multipart upload aborted" },
      401: ERROR_401,
      503: ERROR_503,
    },
  }),
  validator("param", UploadIdParam),
  validator("query", z.object({ key: z.string().min(1) })),
  async (c) => {
    requireS3();
    const { uploadId } = c.req.valid("param" as never) as { uploadId: string };
    const { key } = c.req.valid("query" as never) as { key: string };

    const result = await s3Multipart!.abortMultipartUpload(uploadId, key);

    if (!result.ok) throw result.error;

    return c.json({ ok: true });
  },
);

// GET /s3/multipart/:uploadId — List parts of a multipart upload

uploadRoutes.get(
  "/s3/multipart/:uploadId",
  requireAuth,
  describeRoute({
    description: "List uploaded parts of a multipart upload",
    tags: ["uploads"],
    responses: {
      200: {
        description: "Parts list",
        content: {
          "application/json": { schema: resolver(ListPartsResponseSchema) },
        },
      },
      401: ERROR_401,
      503: ERROR_503,
    },
  }),
  validator("param", UploadIdParam),
  validator("query", z.object({ key: z.string().min(1) })),
  async (c) => {
    requireS3();
    const { uploadId } = c.req.valid("param" as never) as { uploadId: string };
    const { key } = c.req.valid("query" as never) as { key: string };

    const result = await s3Multipart!.listParts(uploadId, key);

    if (!result.ok) throw result.error;

    return c.json(result.value);
  },
);

// POST /complete — Record upload metadata in DB after direct-to-storage upload

uploadRoutes.post(
  "/complete",
  requireAuth,
  describeRoute({
    description: "Record upload metadata after a direct-to-storage upload completes",
    tags: ["uploads"],
    responses: {
      200: { description: "Upload recorded" },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("json", CompleteUploadRequestSchema),
  async (c) => {
    const body = c.req.valid("json" as never) as CompleteUploadRequest;
    const user = c.get("user");
    const roles = c.get("roles") ?? [];

    const { key } = await completeUploadFlow({
      body,
      userId: user.id,
      roles,
      storage,
      logger: c.var.logger,
    });

    return c.json({ ok: true, key });
  },
);
