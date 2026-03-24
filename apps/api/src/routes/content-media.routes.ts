import { Hono } from "hono";
import type { Context } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";

import {
  ContentResponseSchema,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  AppError,
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZES,
} from "@snc/shared";
import type { ContentType } from "@snc/shared";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { auth } from "../auth/auth.js";
import { checkContentAccess } from "../services/content-access.js";
import { requireAuth } from "../middleware/require-auth.js";
import { storage } from "../storage/index.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "../lib/openapi-errors.js";
import { sanitizeFilename, streamFile } from "../lib/file-utils.js";

// ── Private Types ──

type ContentRow = typeof content.$inferSelect;

const UPLOAD_FIELDS = ["media", "thumbnail"] as const;
type UploadField = (typeof UPLOAD_FIELDS)[number];

type UploadConstraints = {
  maxSize: number;
  acceptedTypes: readonly string[];
};

// ── Private Constants ──

const FIELD_KEY_MAP = {
  media: "mediaKey",
  thumbnail: "thumbnailKey",
} as const;

// ── Private Helpers ──

const resolveContentUrls = (row: ContentRow) => ({
  id: row.id,
  creatorId: row.creatorId,
  slug: row.slug ?? null,
  type: row.type,
  title: row.title,
  body: row.body ?? null,
  description: row.description ?? null,
  visibility: row.visibility,
  sourceType: row.sourceType,
  thumbnailUrl: row.thumbnailKey
    ? `/api/content/${row.id}/thumbnail`
    : null,
  mediaUrl: row.mediaKey
    ? `/api/content/${row.id}/media`
    : null,
  publishedAt: row.publishedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const findActiveContent = async (
  id: string,
): Promise<ContentRow | undefined> => {
  const rows = await db
    .select()
    .from(content)
    .where(and(eq(content.id, id), isNull(content.deletedAt)));
  return rows[0];
};

const requireContentOwnership = async (
  id: string,
  userId: string,
): Promise<ContentRow> => {
  const existing = await findActiveContent(id);
  if (!existing) {
    throw new NotFoundError("Content not found");
  }
  await requireCreatorPermission(userId, existing.creatorId, "manageContent");
  return existing;
};

type ContentKeyField = "mediaKey" | "thumbnailKey";

const requireContentFile = async (
  id: string,
  keyField: ContentKeyField,
  notUploadedMsg: string,
): Promise<{ row: ContentRow; key: string }> => {
  const row = await findActiveContent(id);
  if (!row) {
    throw new NotFoundError("Content not found");
  }

  const key = row[keyField];
  if (!key) {
    throw new NotFoundError(notUploadedMsg);
  }

  return { row, key };
};

const streamContentFile = async (
  c: Context<AuthEnv>,
  id: string,
  keyField: ContentKeyField,
  notUploadedMsg: string,
  notFoundMsg: string,
  cacheControl: string,
): Promise<Response> => {
  const { key } = await requireContentFile(id, keyField, notUploadedMsg);
  return streamFile(c, storage, key, notFoundMsg, cacheControl);
};

const UploadQuerySchema = z.object({
  field: z.enum(UPLOAD_FIELDS),
});

const getUploadConstraints = (
  contentType: ContentType,
  field: UploadField,
): UploadConstraints => {
  if (field === "thumbnail") {
    return {
      maxSize: MAX_FILE_SIZES.image,
      acceptedTypes: ACCEPTED_MIME_TYPES.image,
    };
  }
  // field === "media"
  if (contentType === "video") {
    return {
      maxSize: MAX_FILE_SIZES.video,
      acceptedTypes: ACCEPTED_MIME_TYPES.video,
    };
  }
  if (contentType === "audio") {
    return {
      maxSize: MAX_FILE_SIZES.audio,
      acceptedTypes: ACCEPTED_MIME_TYPES.audio,
    };
  }
  // written content has no media file
  throw new ValidationError("Written content does not support media uploads");
};

// ── Public API ──

export const contentMediaRoutes = new Hono<AuthEnv>();

// POST /:id/upload — Upload media file
contentMediaRoutes.post(
  "/:id/upload",
  requireAuth,
  describeRoute({
    description: "Upload a media file or thumbnail for content",
    tags: ["content"],
    responses: {
      200: {
        description: "File uploaded, content metadata updated",
        content: {
          "application/json": { schema: resolver(ContentResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("query", UploadQuerySchema),
  async (c) => {
    const { field } = c.req.valid("query" as never) as { field: UploadField };
    const id = c.req.param("id");
    const user = c.get("user");

    // Look up content and verify ownership
    const existing = await requireContentOwnership(id, user.id);

    // Determine constraints for this field + content type
    const { maxSize, acceptedTypes } = getUploadConstraints(
      existing.type,
      field,
    );

    // Pre-check Content-Length header (reject obviously oversized requests
    // before parsing the multipart body)
    const contentLengthHeader = c.req.header("content-length");
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (!Number.isNaN(contentLength) && contentLength > maxSize) {
        throw new ValidationError(
          `File size exceeds the ${maxSize} byte limit for this field`,
        );
      }
    }

    // Parse multipart body
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!(file instanceof File)) {
      throw new ValidationError("No file provided in 'file' form field");
    }

    // Validate actual file size
    if (file.size > maxSize) {
      throw new ValidationError(
        `File size ${file.size} exceeds the ${maxSize} byte limit`,
      );
    }

    // Validate MIME type
    if (!(acceptedTypes as readonly string[]).includes(file.type)) {
      throw new ValidationError(
        `Invalid MIME type '${file.type}'. Accepted: ${acceptedTypes.join(", ")}`,
      );
    }

    // Generate storage key
    const sanitized = sanitizeFilename(file.name || "upload");
    const key = `content/${id}/${field}/${sanitized}`;

    // Delete old file if re-uploading
    const keyColumn = FIELD_KEY_MAP[field];
    const oldKey = existing[keyColumn];
    if (oldKey) {
      const deleteResult = await storage.delete(oldKey);
      if (!deleteResult.ok) {
        c.var.logger.warn({ error: deleteResult.error.message, key: oldKey }, "Failed to delete old storage file");
      }
    }

    // Upload new file
    const stream = file.stream();
    const uploadResult = await storage.upload(key, stream, {
      contentType: file.type,
      contentLength: file.size,
    });

    if (!uploadResult.ok) {
      throw new AppError("UPLOAD_ERROR", "Failed to upload file", 500);
    }

    // Update DB with new storage key
    const [updated] = await db
      .update(content)
      .set({
        [keyColumn]: key,
        updatedAt: new Date(),
      } as Partial<typeof content.$inferInsert>)
      .where(eq(content.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundError("Content not found");
    }

    return c.json(resolveContentUrls(updated));
  },
);

// GET /:id/media — Stream media file
contentMediaRoutes.get(
  "/:id/media",
  describeRoute({
    description: "Stream the main media file for content",
    tags: ["content"],
    responses: {
      200: {
        description: "Media file stream",
        content: {
          "application/octet-stream": {
            schema: { type: "string", format: "binary" },
          },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  async (c) => {
    const id = c.req.param("id");
    const { row, key } = await requireContentFile(id, "mediaKey", "No media uploaded for this content");

    // Access check: subscribers-only requires active subscription
    if (row.visibility === "subscribers") {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });
      const userId = session?.user?.id ?? null;
      const gate = await checkContentAccess(
        userId,
        row.creatorId,
        row.visibility,
      );
      if (!gate.allowed) {
        if (gate.reason === "AUTHENTICATION_REQUIRED") {
          throw new UnauthorizedError("Authentication required");
        }
        throw new ForbiddenError("Subscription required to access this content");
      }
    }

    return streamFile(c, storage, key, "Media file not found", "private, max-age=3600");
  },
);

// GET /:id/thumbnail — Stream thumbnail image
contentMediaRoutes.get(
  "/:id/thumbnail",
  describeRoute({
    description: "Stream the thumbnail image for content",
    tags: ["content"],
    responses: {
      200: {
        description: "Thumbnail image stream",
        content: {
          "application/octet-stream": {
            schema: { type: "string", format: "binary" },
          },
        },
      },
      404: ERROR_404,
    },
  }),
  async (c) => {
    const id = c.req.param("id");
    return streamContentFile(c, id, "thumbnailKey", "No thumbnail uploaded for this content", "Thumbnail file not found", "public, max-age=86400");
  },
);
