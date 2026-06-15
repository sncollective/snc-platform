import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, and, isNull, or } from "drizzle-orm";

import {
  CreateContentSchema,
  UpdateContentSchema,
  ContentResponseSchema,
  ValidationError,
  NotFoundError,
  AppError,
  FeedItemSchema,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import {
  requireDraftAccess,
  applyContentGate,
} from "../services/content-access.js";
import { requireAuth } from "../middleware/require-auth.js";
import { optionalAuth } from "../middleware/optional-auth.js";
import { storage } from "../storage/index.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "../lib/openapi-errors.js";
import { generateUniqueSlug } from "../services/slug.js";
import { resolveContentUrls, requireContentOwnership } from "../lib/content-helpers.js";
import { CONTENT_FEED_COLUMNS } from "../lib/content-feed-columns.js";
import { IdParam, ContentByCreatorParams } from "./route-params.js";

// ── Public API ──

/** Content CRUD and visibility management. */
export const contentRoutes = new Hono<AuthEnv>();

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

      if (existing.type === "video") {
        // Thumbnail is auto-generated from video — orphan it when the video is removed.
        if (existing.thumbnailKey) {
          const thumbResult = await storage.delete(existing.thumbnailKey);
          if (!thumbResult.ok) {
            c.var.logger.warn({ error: thumbResult.error.message, key: existing.thumbnailKey }, "Failed to delete orphaned thumbnail");
          }
        }
        updates.thumbnailKey = null;

        // transcodedMediaKey is derived from the same source video.
        if (existing.transcodedMediaKey) {
          const transcodedResult = await storage.delete(existing.transcodedMediaKey);
          if (!transcodedResult.ok) {
            c.var.logger.warn({ error: transcodedResult.error.message, key: existing.transcodedMediaKey }, "Failed to delete transcoded media");
          }
        }
        updates.transcodedMediaKey = null;

        // Clear processing metadata — stale metadata from a prior upload must not persist.
        updates.processingStatus = null;
        updates.videoCodec = null;
        updates.audioCodec = null;
        updates.width = null;
        updates.height = null;
        updates.duration = null;
        updates.bitrate = null;
      }

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
