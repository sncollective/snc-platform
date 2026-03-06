import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { eq, and, isNull, isNotNull, desc, lt, or } from "drizzle-orm";

import {
  CreateContentSchema,
  UpdateContentSchema,
  ContentResponseSchema,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  AppError,
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZES,
  FeedQuerySchema,
  FeedResponseSchema,
  FeedItemSchema,
} from "@snc/shared";
import type { ContentResponse, ContentType, Visibility, FeedItem, FeedQuery } from "@snc/shared";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { users } from "../db/schema/user.schema.js";
import { auth } from "../auth/auth.js";
import { checkContentAccess, buildContentAccessContext, hasContentAccess } from "../services/content-access.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import { storage } from "../storage/index.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "./openapi-errors.js";
import { sanitizeFilename, streamFile } from "./file-utils.js";
import { buildPaginatedResponse, decodeCursor } from "./cursor.js";

// ── Private Types ──

type ContentRow = typeof content.$inferSelect;
type FeedRow = ContentRow & { creatorName: string };

const UPLOAD_FIELDS = ["media", "thumbnail", "coverArt"] as const;
type UploadField = (typeof UPLOAD_FIELDS)[number];

type UploadConstraints = {
  maxSize: number;
  acceptedTypes: readonly string[];
};

// ── Private Constants ──

const FIELD_KEY_MAP = {
  media: "mediaKey",
  thumbnail: "thumbnailKey",
  coverArt: "coverArtKey",
} as const;

// ── Private Helpers ──

const resolveContentUrls = (row: ContentRow): ContentResponse => ({
  id: row.id,
  creatorId: row.creatorId,
  type: row.type as ContentType,
  title: row.title,
  body: row.body ?? null,
  description: row.description ?? null,
  visibility: row.visibility as Visibility,
  thumbnailUrl: row.thumbnailKey
    ? `/api/content/${row.id}/thumbnail`
    : null,
  mediaUrl: row.mediaKey
    ? `/api/content/${row.id}/media`
    : null,
  coverArtUrl: row.coverArtKey
    ? `/api/content/${row.id}/cover-art`
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

const fetchCreatorName = async (creatorId: string): Promise<string> => {
  const rows = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, creatorId));
  return rows[0]?.name ?? "Unknown";
};

const requireContentOwnership = async (
  id: string,
  userId: string,
): Promise<ContentRow> => {
  const existing = await findActiveContent(id);
  if (!existing) {
    throw new NotFoundError("Content not found");
  }
  if (existing.creatorId !== userId) {
    throw new ForbiddenError("Not the content owner");
  }
  return existing;
};

const resolveFeedItem = (row: FeedRow): FeedItem => ({
  ...resolveContentUrls(row),
  creatorName: row.creatorName,
});

const UploadQuerySchema = z.object({
  field: z.enum(UPLOAD_FIELDS),
});

const getUploadConstraints = (
  contentType: ContentType,
  field: UploadField,
): UploadConstraints => {
  if (field === "thumbnail" || field === "coverArt") {
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

export const contentRoutes = new Hono<AuthEnv>();

// GET / — List published content feed
contentRoutes.get(
  "/",
  describeRoute({
    description: "List published content with cursor-based pagination",
    tags: ["content"],
    responses: {
      200: {
        description: "Paginated feed of published content",
        content: {
          "application/json": { schema: resolver(FeedResponseSchema) },
        },
      },
      400: ERROR_400,
    },
  }),
  validator("query", FeedQuerySchema),
  async (c) => {
    const {
      limit,
      cursor,
      type: typeFilter,
      creatorId: creatorIdFilter,
    } = c.req.valid("query" as never) as FeedQuery;

    // Resolve session (best-effort — feed is public, session enables gating)
    let userId: string | null = null;
    try {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });
      userId = session?.user?.id ?? null;
    } catch {
      // No session — treat as unauthenticated
    }

    const accessCtx = await buildContentAccessContext(userId);

    // Build WHERE conditions
    const conditions = [
      isNull(content.deletedAt),
      isNotNull(content.publishedAt),
    ];

    if (typeFilter) {
      conditions.push(eq(content.type, typeFilter));
    }

    if (creatorIdFilter) {
      conditions.push(eq(content.creatorId, creatorIdFilter));
    }

    // Decode cursor for keyset pagination
    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "publishedAt",
        idField: "id",
      });
      conditions.push(
        or(
          lt(content.publishedAt, decoded.timestamp),
          and(
            eq(content.publishedAt, decoded.timestamp),
            lt(content.id, decoded.id),
          ),
        )!,
      );
    }

    // Query with JOIN to get creatorName
    const rows = (await db
      .select({
        id: content.id,
        creatorId: content.creatorId,
        type: content.type,
        title: content.title,
        body: content.body,
        description: content.description,
        visibility: content.visibility,
        thumbnailKey: content.thumbnailKey,
        mediaKey: content.mediaKey,
        coverArtKey: content.coverArtKey,
        publishedAt: content.publishedAt,
        deletedAt: content.deletedAt,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
        creatorName: users.name,
      })
      .from(content)
      .innerJoin(users, eq(content.creatorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(content.publishedAt), desc(content.id))
      .limit(limit + 1)) as FeedRow[];

    const { items: rawItems, nextCursor } = buildPaginatedResponse(
      rows,
      limit,
      (last) => ({
        publishedAt: last.publishedAt!.toISOString(),
        id: last.id,
      }),
    );

    const items = rawItems.map((row) => {
      const item = resolveFeedItem(row);
      if (!hasContentAccess(accessCtx, row.creatorId, row.visibility)) {
        item.mediaUrl = null;
        item.body = null;
      }
      return item;
    });

    return c.json({ items, nextCursor });
  },
);

// POST / — Create content
contentRoutes.post(
  "/",
  requireAuth,
  requireRole("creator"),
  describeRoute({
    description: "Create a new content item",
    tags: ["content"],
    responses: {
      201: {
        description: "Content created",
        content: {
          "application/json": { schema: resolver(ContentResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("json", CreateContentSchema),
  async (c) => {
    const body = c.req.valid("json");
    const user = c.get("user");

    if (body.type === "written" && !body.body) {
      throw new ValidationError("Body is required for written content");
    }

    const id = randomUUID();
    const now = new Date();

    const [inserted] = await db.insert(content).values({
      id,
      creatorId: user.id,
      type: body.type,
      title: body.title,
      body: body.body ?? null,
      description: body.description ?? null,
      visibility: body.visibility,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    }).returning();

    if (!inserted) {
      throw new AppError("INSERT_FAILED", "Failed to insert content", 500);
    }

    return c.json(resolveContentUrls(inserted), 201);
  },
);

// GET /:id — Get content metadata
contentRoutes.get(
  "/:id",
  describeRoute({
    description: "Get content metadata by ID",
    tags: ["content"],
    responses: {
      200: {
        description: "Content metadata",
        content: {
          "application/json": { schema: resolver(FeedItemSchema) },
        },
      },
      404: ERROR_404,
    },
  }),
  async (c) => {
    const id = c.req.param("id");
    const row = await findActiveContent(id);

    if (!row) {
      throw new NotFoundError("Content not found");
    }

    const response = resolveContentUrls(row);
    const creatorName = await fetchCreatorName(row.creatorId);

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
        response.mediaUrl = null;
        response.body = null;
      }
    }

    return c.json({ ...response, creatorName });
  },
);

// PATCH /:id — Update content
contentRoutes.patch(
  "/:id",
  requireAuth,
  requireRole("creator"),
  describeRoute({
    description: "Update content metadata",
    tags: ["content"],
    responses: {
      200: {
        description: "Content updated",
        content: {
          "application/json": { schema: resolver(ContentResponseSchema) },
        },
      },
      400: ERROR_400,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("json", UpdateContentSchema),
  async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");
    const body = c.req.valid("json");

    const existing = await requireContentOwnership(id, user.id);

    const [updated] = await db
      .update(content)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(content.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundError("Content not found");
    }

    return c.json(resolveContentUrls(updated));
  },
);

// DELETE /:id — Soft-delete content
contentRoutes.delete(
  "/:id",
  requireAuth,
  requireRole("creator"),
  describeRoute({
    description: "Soft-delete content and remove associated storage files",
    tags: ["content"],
    responses: {
      204: {
        description: "Content deleted",
      },
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");

    const existing = await requireContentOwnership(id, user.id);

    await db
      .update(content)
      .set({ deletedAt: new Date() })
      .where(eq(content.id, id));

    const keysToDelete = [
      existing.thumbnailKey,
      existing.mediaKey,
      existing.coverArtKey,
    ].filter((key): key is string => key !== null);

    const deleteResults = await Promise.all(
      keysToDelete.map((key) => storage.delete(key)),
    );
    for (const result of deleteResults) {
      if (!result.ok) {
        console.error("Failed to delete storage file:", result.error.message);
      }
    }

    return c.body(null, 204);
  },
);

// POST /:id/upload — Upload media file
contentRoutes.post(
  "/:id/upload",
  requireAuth,
  requireRole("creator"),
  describeRoute({
    description: "Upload a media file, thumbnail, or cover art for content",
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
      existing.type as ContentType,
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
        console.error(
          "Failed to delete old storage file:",
          deleteResult.error.message,
        );
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
contentRoutes.get(
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
    const row = await findActiveContent(id);

    if (!row) {
      throw new NotFoundError("Content not found");
    }

    if (!row.mediaKey) {
      throw new NotFoundError("No media uploaded for this content");
    }

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

    return streamFile(c, storage, row.mediaKey, "Media file not found", "private, max-age=3600");
  },
);

// GET /:id/thumbnail — Stream thumbnail image
contentRoutes.get(
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
    const row = await findActiveContent(id);

    if (!row) {
      throw new NotFoundError("Content not found");
    }

    if (!row.thumbnailKey) {
      throw new NotFoundError("No thumbnail uploaded for this content");
    }

    return streamFile(c, storage, row.thumbnailKey, "Thumbnail file not found", "public, max-age=86400");
  },
);

// GET /:id/cover-art — Stream cover art image
contentRoutes.get(
  "/:id/cover-art",
  describeRoute({
    description: "Stream the cover art image for content",
    tags: ["content"],
    responses: {
      200: {
        description: "Cover art image stream",
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
    const row = await findActiveContent(id);

    if (!row) {
      throw new NotFoundError("Content not found");
    }

    if (!row.coverArtKey) {
      throw new NotFoundError("No cover art uploaded for this content");
    }

    return streamFile(c, storage, row.coverArtKey, "Cover art file not found", "public, max-age=86400");
  },
);
