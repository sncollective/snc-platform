import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, and, desc, type SQL } from "drizzle-orm";

import {
  CreatorProfileResponseSchema,
  CreatorListQuerySchema,
  CreatorListResponseSchema,
  UpdateCreatorProfileSchema,
  NotFoundError,
  ValidationError,
} from "@snc/shared";
import type {
  CreatorListQuery,
  UpdateCreatorProfile,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { optionalAuth } from "../middleware/optional-auth.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "../lib/openapi-errors.js";
import { buildCursorCondition, buildPaginatedResponse, decodeCursor } from "../lib/cursor.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import { generateUniqueSlug } from "../services/slug.js";
import {
  batchGetContentCounts,
  batchGetSubscribedCreatorIds,
  batchGetSubscriberCounts,
  batchGetLastPublished,
} from "../services/creator-list.js";
import { findCreatorProfile, getContentCount, toProfileResponse } from "../lib/creator-helpers.js";
import { CreatorIdParam } from "./route-params.js";

// (no private helpers — getContentCount and toProfileResponse are in lib/creator-helpers.ts)

// ── Public API ──

/** Creator profile CRUD and discovery. */
export const creatorRoutes = new Hono<AuthEnv>();

// GET / — List creators
creatorRoutes.get(
  "/",
  describeRoute({
    description: "List creators with cursor-based pagination",
    tags: ["creators"],
    responses: {
      200: {
        description: "Paginated list of creators",
        content: {
          "application/json": { schema: resolver(CreatorListResponseSchema) },
        },
      },
      400: ERROR_400,
    },
  }),
  optionalAuth,
  validator("query", CreatorListQuerySchema),
  async (c) => {
    const { limit, cursor } = c.req.valid("query" as never) as CreatorListQuery;

    // Active-only filter + optional cursor condition for keyset pagination
    const conditions: SQL[] = [eq(creatorProfiles.status, "active")];

    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "createdAt",
        idField: "id",
      });
      conditions.push(
        buildCursorCondition(
          creatorProfiles.createdAt,
          creatorProfiles.id,
          decoded,
          "desc",
        ),
      );
    }

    // Query with limit + 1 for next-page detection
    const rows = await db
      .select()
      .from(creatorProfiles)
      .where(and(...conditions))
      .orderBy(desc(creatorProfiles.createdAt), desc(creatorProfiles.id))
      .limit(limit + 1);

    const { items: rawRows, nextCursor } = buildPaginatedResponse(
      rows,
      limit,
      (last) => ({
        createdAt: last.createdAt.toISOString(),
        id: last.id,
      }),
    );

    // Batch-fetch content counts to avoid N+1 queries
    const countMap = await batchGetContentCounts(rawRows.map((r) => r.id));
    const items = rawRows.map((row) =>
      toProfileResponse(row, countMap.get(row.id) ?? 0),
    );

    // Enrich with canManage, subscription status, and KPIs
    const userId = (c.get("user") as { id: string } | undefined)?.id;
    const roles = (c.get("roles") ?? []) as string[];
    const isManageEligible = roles.includes("stakeholder") || roles.includes("admin");
    const creatorIds = rawRows.map((r) => r.id);

    // Authenticated: fetch subscription status for current user
    const subscribedIds = userId
      ? await batchGetSubscribedCreatorIds(userId, creatorIds)
      : new Set<string>();

    // Stakeholder/admin: fetch KPIs
    const [subscriberCounts, lastPublished] = isManageEligible
      ? await Promise.all([
          batchGetSubscriberCounts(creatorIds),
          batchGetLastPublished(creatorIds),
        ])
      : [new Map<string, number>(), new Map<string, string>()];

    const enrichedItems = items.map((item) => ({
      ...item,
      ...(userId ? { isSubscribed: subscribedIds.has(item.id) } : {}),
      ...(isManageEligible
        ? {
            canManage: true,
            subscriberCount: subscriberCounts.get(item.id) ?? 0,
            lastPublishedAt: lastPublished.get(item.id) ?? null,
          }
        : {}),
    }));

    // Sort: subscribed creators first (stable sort preserves createdAt order within groups)
    if (userId) {
      enrichedItems.sort((a, b) => {
        const aSubscribed = subscribedIds.has(a.id) ? 1 : 0;
        const bSubscribed = subscribedIds.has(b.id) ? 1 : 0;
        return bSubscribed - aSubscribed;
      });
    }

    return c.json({ items: enrichedItems, nextCursor });
  },
);

// GET /:creatorId — Get creator profile
creatorRoutes.get(
  "/:creatorId",
  describeRoute({
    description: "Get a creator profile by ID",
    tags: ["creators"],
    responses: {
      200: {
        description: "Creator profile",
        content: {
          "application/json": {
            schema: resolver(CreatorProfileResponseSchema),
          },
        },
      },
      404: ERROR_404,
    },
  }),
  optionalAuth,
  validator("param", CreatorIdParam),
  async (c) => {
    const { creatorId } = c.req.valid("param" as never) as { creatorId: string };
    const profile = await findCreatorProfile(creatorId, { activeOnly: true });

    if (!profile) {
      throw new NotFoundError("Creator not found");
    }

    const contentCount = await getContentCount(profile.id);
    const response = toProfileResponse(profile, contentCount);
    return c.json(response);
  },
);

// PATCH /:creatorId — Update creator profile
creatorRoutes.patch(
  "/:creatorId",
  requireAuth,
  describeRoute({
    description: "Update a creator profile (owner/editor)",
    tags: ["creators"],
    responses: {
      200: {
        description: "Updated creator profile",
        content: {
          "application/json": {
            schema: resolver(CreatorProfileResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("param", CreatorIdParam),
  validator("json", UpdateCreatorProfileSchema),
  async (c) => {
    const { creatorId } = c.req.valid("param" as never) as { creatorId: string };
    const user = c.get("user");
    const body = c.req.valid("json") as UpdateCreatorProfile;

    const profile = await findCreatorProfile(creatorId);
    if (!profile) {
      throw new NotFoundError("Creator profile not found");
    }

    await requireCreatorPermission(user.id, profile.id, "editProfile");

    // Regenerate handle when displayName changes and no explicit handle is provided
    let patchBody = body;
    if (patchBody.displayName && patchBody.displayName !== profile.displayName && !patchBody.handle) {
      const newHandle = await generateUniqueSlug(patchBody.displayName, {
        table: creatorProfiles,
        slugColumn: creatorProfiles.handle,
        excludeId: profile.id,
        idColumn: creatorProfiles.id,
        maxLength: 30,
        fallbackPrefix: "creator",
      });
      patchBody = { ...patchBody, handle: newHandle };
    }

    // Validate handle uniqueness before update
    if (patchBody.handle && patchBody.handle !== profile.handle) {
      const existing = await db
        .select({ id: creatorProfiles.id })
        .from(creatorProfiles)
        .where(eq(creatorProfiles.handle, patchBody.handle));
      if (existing.length > 0) {
        throw new ValidationError(`Handle '${patchBody.handle}' is already taken`);
      }
    }

    const [updated] = await db
      .update(creatorProfiles)
      .set({ ...patchBody, updatedAt: new Date() })
      .where(eq(creatorProfiles.id, profile.id))
      .returning();

    if (!updated) {
      throw new NotFoundError("Creator profile not found");
    }

    const contentCount = await getContentCount(profile.id);
    const response = toProfileResponse(updated, contentCount);
    return c.json(response);
  },
);
