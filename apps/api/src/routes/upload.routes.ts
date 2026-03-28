import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { eq, and } from "drizzle-orm";

import {
  AppError,
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZES,
} from "@snc/shared";
import type { UploadPurpose } from "@snc/shared";
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
import { creatorProfiles, creatorMembers } from "../db/schema/creator.schema.js";
import { sanitizeFilename } from "../lib/file-utils.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_503 } from "../lib/openapi-errors.js";
import { UploadIdParam, UploadPartParams } from "./route-params.js";

// ── Private Constants ──

const PRESIGN_EXPIRY_SECONDS = 3600; // 1 hour

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

    const [member] = await db
      .select({ userId: creatorMembers.userId })
      .from(creatorMembers)
      .where(and(
        eq(creatorMembers.creatorId, row.creatorId),
        eq(creatorMembers.userId, userId),
      ))
      .limit(1);
    if (!member) {
      throw new AppError("FORBIDDEN", "Not the content owner", 403);
    }
    return { contentType: row.type };
  }

  if (purpose.startsWith("creator-")) {
    const [member] = await db
      .select({ userId: creatorMembers.userId })
      .from(creatorMembers)
      .where(and(
        eq(creatorMembers.creatorId, resourceId),
        eq(creatorMembers.userId, userId),
      ))
      .limit(1);
    if (!member) {
      throw new AppError("FORBIDDEN", "Not the profile owner", 403);
    }
    return {};
  }

  throw new ValidationError("Invalid purpose");
};

const recordUpload = async (
  purpose: UploadPurpose,
  resourceId: string,
  key: string,
): Promise<void> => {
  if (purpose === "content-media") {
    await db
      .update(content)
      .set({ mediaKey: key, updatedAt: new Date() })
      .where(eq(content.id, resourceId));
  } else if (purpose === "content-thumbnail") {
    await db
      .update(content)
      .set({ thumbnailKey: key, updatedAt: new Date() })
      .where(eq(content.id, resourceId));
  } else if (purpose === "creator-avatar") {
    await db
      .update(creatorProfiles)
      .set({ avatarKey: key, updatedAt: new Date() })
      .where(eq(creatorProfiles.id, resourceId));
  } else if (purpose === "creator-banner") {
    await db
      .update(creatorProfiles)
      .set({ bannerKey: key, updatedAt: new Date() })
      .where(eq(creatorProfiles.id, resourceId));
  } else if (purpose === "playout-media") {
    await db
      .update(playoutItems)
      .set({ sourceKey: key, updatedAt: new Date() })
      .where(eq(playoutItems.id, resourceId));
  } else {
    throw new ValidationError("Invalid purpose for completion");
  }
};

// ── Public Routes ──

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
      PRESIGN_EXPIRY_SECONDS,
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
      PRESIGN_EXPIRY_SECONDS,
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

    const expectedPrefix = `${PURPOSE_KEY_PREFIX[body.purpose]}/${body.resourceId}/${PURPOSE_FIELD[body.purpose]}/`;
    if (!body.key.startsWith(expectedPrefix)) {
      throw new ValidationError("Key does not match the expected upload path");
    }

    await verifyOwnership(body.purpose, body.resourceId, user.id, roles);

    const purposeCategory =
      body.purpose === "content-media"
        ? "media"
        : body.purpose === "playout-media"
          ? "video"
          : body.purpose.includes("thumbnail") ||
              body.purpose.includes("avatar") ||
              body.purpose.includes("banner")
            ? "image"
            : "media";

    const headResult = await storage.head(body.key);
    if (!headResult.ok) {
      throw new ValidationError("File not found in storage — upload may have failed");
    }
    const maxSize = MAX_FILE_SIZES[purposeCategory as keyof typeof MAX_FILE_SIZES];
    if (headResult.value.size > maxSize) {
      await storage.delete(body.key);
      throw new ValidationError("Uploaded file exceeds size limit");
    }

    if (body.purpose.startsWith("content-")) {
      const [existing] = await db
        .select()
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
          c.var.logger.warn({ error: deleteResult.error.message, key: oldKey }, "Failed to delete old file");
        }
      }
    }

    await recordUpload(body.purpose, body.resourceId, body.key);

    if (body.purpose === "content-media") {
      // Set processing status to "processing"
      await db
        .update(content)
        .set({ processingStatus: "processing", updatedAt: new Date() })
        .where(eq(content.id, body.resourceId));

      // Queue probe job
      const boss = getBoss();
      if (boss) {
        await boss.send(JOB_QUEUES.PROBE_CODEC, { contentId: body.resourceId });
      }
    }

    if (body.purpose === "playout-media") {
      // Set processing status to "uploading" → ingest job will set it to "processing"
      await db
        .update(playoutItems)
        .set({ processingStatus: "uploading", updatedAt: new Date() })
        .where(eq(playoutItems.id, body.resourceId));

      // Queue playout ingest job
      const boss = getBoss();
      if (boss) {
        await boss.send(JOB_QUEUES.PLAYOUT_INGEST, { playoutItemId: body.resourceId });
      }
    }

    return c.json({ ok: true, key: body.key });
  },
);
