import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, and, isNull, isNotNull, desc, or } from "drizzle-orm";

import {
  CreateContentSchema,
  UpdateContentSchema,
  ContentResponseSchema,
  ValidationError,
  NotFoundError,
  AppError,
  FeedQuerySchema,
  FeedResponseSchema,
  FeedItemSchema,
  DraftQuerySchema,
} from "@snc/shared";
import type { ContentResponse, FeedItem, FeedQuery, DraftQuery } from "@snc/shared";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import {
  buildContentAccessContext,
  hasContentAccess,
  requireDraftAccess,
  applyContentGate,
} from "../services/content-access.js";
import { requireAuth } from "../middleware/require-auth.js";
import { optionalAuth } from "../middleware/optional-auth.js";
import { storage } from "../storage/index.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "../lib/openapi-errors.js";
import { buildCursorCondition, buildPaginatedResponse, decodeCursor } from "../lib/cursor.js";
import { generateUniqueSlug } from "../services/slug.js";
import { resolveContentUrls, requireContentOwnership } from "../lib/content-helpers.js";
import type { ContentRow } from "../lib/content-helpers.js";
import { toISO, toISOOrNull } from "../lib/response-helpers.js";
import { IdParam, ContentByCreatorParams } from "./route-params.js";

// ── Private Types ──

type FeedRow = ContentRow & { creatorName: string | null; creatorHandle: string | null; creatorStatus: string | null };

// ── Private Constants ──

const CONTENT_FEED_COLUMNS = {
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
  processingStatus: content.processingStatus,
  transcodedMediaKey: content.transcodedMediaKey,
  videoCodec: content.videoCodec,
  audioCodec: content.audioCodec,
  width: content.width,
  height: content.height,
  duration: content.duration,
  bitrate: content.bitrate,
  creatorName: creatorProfiles.displayName,
  creatorHandle: creatorProfiles.handle,
  creatorStatus: creatorProfiles.status,
} as const;

// ── Private Helpers ──

const resolveFeedItem = (row: FeedRow): FeedItem => ({
  ...resolveContentUrls(row),
  creatorName: row.creatorName ?? "",
  creatorHandle: row.creatorHandle ?? null,
});

// ── Public API ──

/** Content CRUD, feed queries, and visibility management. */
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
  optionalAuth,
  validator("query", FeedQuerySchema),
  async (c) => {
    const {
      limit,
      cursor,
      type: typeFilter,
      creatorId: creatorIdFilter,
    } = c.req.valid("query" as never) as FeedQuery;

    const user = c.get("user");
    const roles = c.get("roles") as string[];
    const accessCtx = await buildContentAccessContext(user?.id ?? null, roles);

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

    // Only show content from active creators
    conditions.push(eq(creatorProfiles.status, "active"));

    // Decode cursor for keyset pagination
    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "publishedAt",
        idField: "id",
      });
      conditions.push(
        buildCursorCondition(content.publishedAt, content.id, decoded, "desc"),
      );
    }

    // Query with JOIN to get creatorName and creatorHandle
    const rows = (await db
      .select(CONTENT_FEED_COLUMNS)
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
      type: typeFilter,
    } = c.req.valid("query" as never) as DraftQuery;
    const user = c.get("user");

    await requireCreatorPermission(user.id, creatorId, "manageContent");

    const conditions = [
      isNull(content.deletedAt),
      isNull(content.publishedAt),
      eq(content.creatorId, creatorId),
    ];

    if (typeFilter) {
      conditions.push(eq(content.type, typeFilter));
    }

    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "createdAt",
        idField: "id",
      });
      conditions.push(
        buildCursorCondition(content.createdAt, content.id, decoded, "desc"),
      );
    }

    const rows = await db
      .select(CONTENT_FEED_COLUMNS)
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
  validator("param", ContentByCreatorParams),
  optionalAuth,
  async (c) => {
    const { creatorIdentifier, contentIdentifier } = c.req.valid("param" as never) as { creatorIdentifier: string; contentIdentifier: string };
    const user = c.get("user");
    const roles = c.get("roles") as string[];

    // Resolve creator by handle or ID (active only for public routes)
    const creatorRows = await db
      .select({
        id: creatorProfiles.id,
        name: creatorProfiles.displayName,
        handle: creatorProfiles.handle,
      })
      .from(creatorProfiles)
      .where(
        and(
          or(
            eq(creatorProfiles.id, creatorIdentifier),
            eq(creatorProfiles.handle, creatorIdentifier),
          ),
          eq(creatorProfiles.status, "active"),
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

    await requireDraftAccess(row, user?.id ?? null, roles);

    const response = await applyContentGate(row, user?.id ?? null, resolveContentUrls(row), roles);

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
  validator("param", IdParam),
  optionalAuth,
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
    const user = c.get("user");
    const roles = c.get("roles") as string[];

    // Single query: fetch content + creator name/handle via left join
    const joined = await db
      .select({
        ...CONTENT_FEED_COLUMNS,
      })
      .from(content)
      .leftJoin(creatorProfiles, eq(content.creatorId, creatorProfiles.id))
      .where(and(eq(content.id, id), isNull(content.deletedAt)));
    const row = joined[0];

    if (!row) {
      throw new NotFoundError("Content not found");
    }

    if (row.creatorStatus !== "active") {
      throw new NotFoundError("Content not found");
    }

    await requireDraftAccess(row, user?.id ?? null, roles);

    const response = await applyContentGate(row, user?.id ?? null, resolveContentUrls(row), roles);

    return c.json({
      ...response,
      creatorName: row.creatorName ?? "",
      creatorHandle: row.creatorHandle ?? null,
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
  validator("param", IdParam),
  validator("json", UpdateContentSchema),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
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
  validator("param", IdParam),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
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
  validator("param", IdParam),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
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

    if (
      existing.type !== "written" &&
      existing.processingStatus != null &&
      existing.processingStatus !== "ready"
    ) {
      throw new ValidationError(
        "Media is still being processed. Please wait until processing completes before publishing.",
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
  validator("param", IdParam),
  async (c) => {
    const { id } = c.req.valid("param" as never) as { id: string };
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


