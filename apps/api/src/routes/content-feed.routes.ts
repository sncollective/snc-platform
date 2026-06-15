import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, and, isNull, isNotNull, desc, or } from "drizzle-orm";

import {
  FeedResponseSchema,
  FeedQuerySchema,
  DraftQuerySchema,
} from "@snc/shared";
import type { FeedQuery, DraftQuery } from "@snc/shared";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import {
  buildContentAccessContext,
  hasContentAccess,
} from "../services/content-access.js";
import { optionalAuth } from "../middleware/optional-auth.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403 } from "../lib/openapi-errors.js";
import { buildCursorCondition, buildPaginatedResponse, decodeCursor } from "../lib/cursor.js";
import { CONTENT_FEED_COLUMNS, resolveFeedItem } from "../lib/content-feed-columns.js";

/** Published content feed and draft listing queries. */
export const contentFeedRoutes = new Hono<AuthEnv>();

// GET / — List published content feed
contentFeedRoutes.get(
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

// GET /drafts — List unpublished draft content for a creator
contentFeedRoutes.get(
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
