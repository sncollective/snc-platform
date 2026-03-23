import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import type { Context } from "hono";
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
  DraftQuerySchema,
} from "@snc/shared";
import type { ContentResponse, ContentType, FeedItem, FeedQuery, DraftQuery } from "@snc/shared";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { auth } from "../auth/auth.js";
import { checkContentAccess, buildContentAccessContext, hasContentAccess } from "../services/content-access.js";
import { requireAuth } from "../middleware/require-auth.js";
import { storage } from "../storage/index.js";
import { requireCreatorPermission, checkCreatorPermission } from "../services/creator-team.js";
import { getUserRoles } from "../auth/user-roles.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "./openapi-errors.js";
import { sanitizeFilename, streamFile } from "./file-utils.js";
import { buildPaginatedResponse, decodeCursor } from "./cursor.js";
import { generateUniqueSlug } from "../services/slug.js";

// ── Private Types ──

type ContentRow = typeof content.$inferSelect;
type FeedRow = ContentRow & { creatorName: string | null; creatorHandle: string | null };

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

const resolveContentUrls = (row: ContentRow): ContentResponse => ({
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

const fetchCreatorInfo = async (
  creatorId: string,
): Promise<{ name: string; handle: string | null }> => {
  const rows = await db
    .select({
      name: creatorProfiles.displayName,
      handle: creatorProfiles.handle,
    })
    .from(creatorProfiles)
    .where(eq(creatorProfiles.id, creatorId));
  return { name: rows[0]?.name ?? "Unknown", handle: rows[0]?.handle ?? null };
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

const resolveFeedItem = (row: FeedRow): FeedItem => ({
  ...resolveContentUrls(row),
  creatorName: row.creatorName ?? "",
  creatorHandle: row.creatorHandle ?? null,
});

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

    // Belt-and-suspenders: exclude video/audio without mediaKey from feed
    conditions.push(
      or(
        eq(content.type, "written"),
        isNotNull(content.mediaKey),
      )!,
    );

    // Decode cursor for keyset pagination
    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "publishedAt",
        idField: "id",
      });
      const cursorCondition = or(
        lt(content.publishedAt, decoded.timestamp),
        and(
          eq(content.publishedAt, decoded.timestamp),
          lt(content.id, decoded.id),
        ),
      );
      if (cursorCondition) conditions.push(cursorCondition);
    }

    // Query with JOIN to get creatorName and creatorHandle
    const rows = (await db
      .select({
        id: content.id,
        creatorId: content.creatorId,
        type: content.type,
        title: content.title,
        slug: content.slug,
        body: content.body,
        description: content.description,
        visibility: content.visibility,
        sourceType: content.sourceType,
        thumbnailKey: content.thumbnailKey,
        mediaKey: content.mediaKey,
        publishedAt: content.publishedAt,
        deletedAt: content.deletedAt,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
        creatorName: creatorProfiles.displayName,
        creatorHandle: creatorProfiles.handle,
      })
      .from(content)
      .innerJoin(creatorProfiles, eq(content.creatorId, creatorProfiles.id))
      .where(and(...conditions))
      .orderBy(desc(content.publishedAt), desc(content.id))
      .limit(limit + 1));

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

    await requireCreatorPermission(user.id, body.creatorId, "manageContent");

    const id = randomUUID();
    const now = new Date();

    const slug = await generateUniqueSlug(body.title, {
      table: content,
      slugColumn: content.slug,
      scopeColumn: content.creatorId,
      scopeValue: body.creatorId,
      fallbackPrefix: "content",
    });

    const [inserted] = await db.insert(content).values({
      id,
      creatorId: body.creatorId,
      type: body.type,
      title: body.title,
      slug,
      body: body.body ?? null,
      description: body.description ?? null,
      visibility: body.visibility,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    }).returning();

    if (!inserted) {
      throw new AppError("INSERT_FAILED", "Failed to insert content", 500);
    }

    return c.json(resolveContentUrls(inserted), 201);
  },
);

// GET /drafts — List unpublished draft content for a creator
contentRoutes.get(
  "/drafts",
  requireAuth,
  describeRoute({
    description: "List unpublished draft content for a creator",
    tags: ["content"],
    responses: {
      200: {
        description: "Paginated list of draft content",
        content: {
          "application/json": { schema: resolver(FeedResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("query", DraftQuerySchema),
  async (c) => {
    const {
      creatorId,
      limit,
      cursor,
    } = c.req.valid("query" as never) as DraftQuery;
    const user = c.get("user");

    await requireCreatorPermission(user.id, creatorId, "manageContent");

    const conditions = [
      isNull(content.deletedAt),
      isNull(content.publishedAt),
      eq(content.creatorId, creatorId),
    ];

    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "createdAt",
        idField: "id",
      });
      const cursorCondition = or(
        lt(content.createdAt, decoded.timestamp),
        and(
          eq(content.createdAt, decoded.timestamp),
          lt(content.id, decoded.id),
        ),
      );
      if (cursorCondition) conditions.push(cursorCondition);
    }

    const rows = await db
      .select({
        id: content.id,
        creatorId: content.creatorId,
        type: content.type,
        title: content.title,
        slug: content.slug,
        body: content.body,
        description: content.description,
        visibility: content.visibility,
        sourceType: content.sourceType,
        thumbnailKey: content.thumbnailKey,
        mediaKey: content.mediaKey,
        publishedAt: content.publishedAt,
        deletedAt: content.deletedAt,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
        creatorName: creatorProfiles.displayName,
        creatorHandle: creatorProfiles.handle,
      })
      .from(content)
      .innerJoin(creatorProfiles, eq(content.creatorId, creatorProfiles.id))
      .where(and(...conditions))
      .orderBy(desc(content.createdAt), desc(content.id))
      .limit(limit + 1);

    const { items: rawItems, nextCursor } = buildPaginatedResponse(
      rows,
      limit,
      (last) => ({
        createdAt: last.createdAt.toISOString(),
        id: last.id,
      }),
    );

    const items = rawItems.map((row) => resolveFeedItem(row));

    return c.json({ items, nextCursor });
  },
);

// GET /by-creator/:creatorIdentifier/:contentIdentifier — Resolve content by creator+slug
contentRoutes.get(
  "/by-creator/:creatorIdentifier/:contentIdentifier",
  describeRoute({
    description: "Resolve content by creator handle/ID and content slug/ID",
    tags: ["content"],
    responses: {
      200: {
        description: "Content detail",
        content: {
          "application/json": { schema: resolver(FeedItemSchema) },
        },
      },
      404: ERROR_404,
    },
  }),
  async (c) => {
    const creatorIdentifier = c.req.param("creatorIdentifier");
    const contentIdentifier = c.req.param("contentIdentifier");

    // Resolve creator by handle or ID
    const creatorRows = await db
      .select({
        id: creatorProfiles.id,
        name: creatorProfiles.displayName,
        handle: creatorProfiles.handle,
      })
      .from(creatorProfiles)
      .where(
        or(
          eq(creatorProfiles.id, creatorIdentifier),
          eq(creatorProfiles.handle, creatorIdentifier),
        ),
      );
    const creator = creatorRows[0];
    if (!creator) throw new NotFoundError("Content not found");

    // Resolve content by slug or ID within that creator
    const rows = await db
      .select()
      .from(content)
      .where(
        and(
          eq(content.creatorId, creator.id),
          isNull(content.deletedAt),
          or(
            eq(content.id, contentIdentifier),
            eq(content.slug, contentIdentifier),
          ),
        ),
      );
    const row = rows[0];
    if (!row) throw new NotFoundError("Content not found");

    // Draft access control (same as GET /:id)
    if (!row.publishedAt) {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      const userId = session?.user?.id ?? null;
      if (!userId) throw new NotFoundError("Content not found");
      const roles = await getUserRoles(userId);
      const isAdmin = roles.includes("admin") || roles.includes("stakeholder");
      if (!isAdmin) {
        const hasPermission = await checkCreatorPermission(
          userId,
          row.creatorId,
          "manageContent",
          roles,
        );
        if (!hasPermission) throw new NotFoundError("Content not found");
      }
    }

    const response = resolveContentUrls(row);

    // Content gating (same as GET /:id)
    if (row.visibility === "subscribers") {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      const userId = session?.user?.id ?? null;
      const gate = await checkContentAccess(userId, row.creatorId, row.visibility);
      if (!gate.allowed) {
        response.mediaUrl = null;
        response.body = null;
      }
    }

    return c.json({
      ...response,
      creatorName: creator.name ?? "",
      creatorHandle: creator.handle ?? null,
    });
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

    // Draft access control: only authorized users can preview drafts
    if (!row.publishedAt) {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });
      const userId = session?.user?.id ?? null;
      if (!userId) {
        throw new NotFoundError("Content not found");
      }
      const roles = await getUserRoles(userId);
      const isAdmin = roles.includes("admin") || roles.includes("stakeholder");
      if (!isAdmin) {
        const hasPermission = await checkCreatorPermission(
          userId,
          row.creatorId,
          "manageContent",
          roles,
        );
        if (!hasPermission) {
          throw new NotFoundError("Content not found");
        }
      }
    }

    const response = resolveContentUrls(row);
    const creatorInfo = await fetchCreatorInfo(row.creatorId);

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

    return c.json({
      ...response,
      creatorName: creatorInfo.name,
      creatorHandle: creatorInfo.handle,
    });
  },
);

// PATCH /:id — Update content
contentRoutes.patch(
  "/:id",
  requireAuth,
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

    const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };

    if (body.clearThumbnail) {
      if (existing.thumbnailKey) {
        const deleteResult = await storage.delete(existing.thumbnailKey);
        if (!deleteResult.ok) {
          c.var.logger.warn({ error: deleteResult.error.message, key: existing.thumbnailKey }, "Failed to delete thumbnail");
        }
      }
      updates.thumbnailKey = null;
      delete updates.clearThumbnail;
    }

    if (body.clearMedia) {
      if (existing.mediaKey) {
        const deleteResult = await storage.delete(existing.mediaKey);
        if (!deleteResult.ok) {
          c.var.logger.warn({ error: deleteResult.error.message, key: existing.mediaKey }, "Failed to delete media");
        }
      }
      updates.mediaKey = null;
      delete updates.clearMedia;
    }

    if (body.title && body.title !== existing.title) {
      updates.slug = await generateUniqueSlug(body.title, {
        table: content,
        slugColumn: content.slug,
        scopeColumn: content.creatorId,
        scopeValue: existing.creatorId,
        excludeId: existing.id,
        idColumn: content.id,
        fallbackPrefix: "content",
      });
    }

    const [updated] = await db
      .update(content)
      .set(updates)
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
    ].filter((key): key is string => key !== null);

    const deleteResults = await Promise.all(
      keysToDelete.map((key) => storage.delete(key)),
    );
    for (const result of deleteResults) {
      if (!result.ok) {
        c.var.logger.warn({ error: result.error.message }, "Failed to delete storage file");
      }
    }

    return c.body(null, 204);
  },
);

// POST /:id/publish — Publish content
contentRoutes.post(
  "/:id/publish",
  requireAuth,
  describeRoute({
    description: "Publish a draft content item",
    tags: ["content"],
    responses: {
      200: {
        description: "Content published",
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
  async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");

    const existing = await requireContentOwnership(id, user.id);

    if (existing.publishedAt) {
      throw new ValidationError("Content is already published");
    }

    if (existing.type !== "written" && !existing.mediaKey) {
      throw new ValidationError(
        "Video and audio content requires media to be uploaded before publishing",
      );
    }

    const now = new Date();
    const [updated] = await db
      .update(content)
      .set({ publishedAt: now, updatedAt: now })
      .where(eq(content.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundError("Content not found");
    }

    return c.json(resolveContentUrls(updated));
  },
);

// POST /:id/unpublish — Unpublish content (revert to draft)
contentRoutes.post(
  "/:id/unpublish",
  requireAuth,
  describeRoute({
    description: "Unpublish content (revert to draft)",
    tags: ["content"],
    responses: {
      200: {
        description: "Content unpublished",
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
  async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");

    const existing = await requireContentOwnership(id, user.id);

    if (!existing.publishedAt) {
      throw new ValidationError("Content is already a draft");
    }

    const now = new Date();
    const [updated] = await db
      .update(content)
      .set({ publishedAt: null, updatedAt: now })
      .where(eq(content.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundError("Content not found");
    }

    return c.json(resolveContentUrls(updated));
  },
);

// POST /:id/upload — Upload media file
contentRoutes.post(
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
    return streamContentFile(c, id, "thumbnailKey", "No thumbnail uploaded for this content", "Thumbnail file not found", "public, max-age=86400");
  },
);

