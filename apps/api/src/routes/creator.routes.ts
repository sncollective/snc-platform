import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import type { Context } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, and, isNull, isNotNull, desc, lt, or, count, inArray, ilike, notInArray, sql } from "drizzle-orm";

import {
  CreatorProfileResponseSchema,
  CreatorListQuerySchema,
  CreatorListResponseSchema,
  UpdateCreatorProfileSchema,
  CreateCreatorSchema,
  AddCreatorMemberSchema,
  UpdateCreatorMemberSchema,
  CreatorMembersResponseSchema,
  CandidatesQuerySchema,
  CandidatesResponseSchema,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  AppError,
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZES,
} from "@snc/shared";
import type {
  CreatorProfileResponse,
  CreatorListQuery,
  UpdateCreatorProfile,
  CreateCreator,
  AddCreatorMember,
  UpdateCreatorMember,
  CreatorMemberRole,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorProfiles, creatorMembers } from "../db/schema/creator.schema.js";
import { content } from "../db/schema/content.schema.js";
import { users, userRoles } from "../db/schema/user.schema.js";
import { userSubscriptions, subscriptionPlans } from "../db/schema/subscription.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import { optionalAuth } from "../middleware/optional-auth.js";
import type { OptionalAuthEnv } from "../middleware/optional-auth.js";
import { storage } from "../storage/index.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "./openapi-errors.js";
import { sanitizeFilename, streamFile } from "./file-utils.js";
import { buildPaginatedResponse, decodeCursor } from "./cursor.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import { generateUniqueSlug } from "../services/slug.js";

// ── Private Types ──

type CreatorProfileRow = typeof creatorProfiles.$inferSelect;

// ── Private Helpers ──

const resolveCreatorUrls = (
  profile: CreatorProfileRow,
): { avatarUrl: string | null; bannerUrl: string | null } => ({
  avatarUrl: profile.avatarKey
    ? `/api/creators/${profile.id}/avatar`
    : null,
  bannerUrl: profile.bannerKey
    ? `/api/creators/${profile.id}/banner`
    : null,
});

const findCreatorProfile = async (
  identifier: string,
): Promise<CreatorProfileRow | undefined> => {
  const rows = await db
    .select()
    .from(creatorProfiles)
    .where(
      or(
        eq(creatorProfiles.id, identifier),
        eq(creatorProfiles.handle, identifier),
      ),
    );
  return rows[0];
};

const getContentCount = async (creatorId: string): Promise<number> => {
  const rows = await db
    .select({ count: count() })
    .from(content)
    .where(
      and(
        eq(content.creatorId, creatorId),
        isNull(content.deletedAt),
        isNotNull(content.publishedAt),
      ),
    );
  return rows[0]?.count ?? 0;
};

const toProfileResponse = (
  profile: CreatorProfileRow,
  contentCount: number,
): CreatorProfileResponse => {
  const urls = resolveCreatorUrls(profile);
  return {
    id: profile.id,
    displayName: profile.displayName,
    bio: profile.bio ?? null,
    handle: profile.handle ?? null,
    avatarUrl: urls.avatarUrl,
    bannerUrl: urls.bannerUrl,
    socialLinks: profile.socialLinks ?? [],
    contentCount,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
};

const batchGetContentCounts = async (
  creatorIds: string[],
): Promise<Map<string, number>> => {
  if (creatorIds.length === 0) return new Map();
  const rows = await db
    .select({ creatorId: content.creatorId, count: count() })
    .from(content)
    .where(
      and(
        inArray(content.creatorId, creatorIds),
        isNull(content.deletedAt),
        isNotNull(content.publishedAt),
      ),
    )
    .groupBy(content.creatorId);
  return new Map(rows.map((r) => [r.creatorId, r.count]));
};

/** Returns set of creatorIds the user is subscribed to (active platform OR active creator sub) */
const batchGetSubscribedCreatorIds = async (
  userId: string,
  creatorIds: string[],
): Promise<Set<string>> => {
  if (creatorIds.length === 0) return new Set();

  // Check for active platform subscription (patron of all creators)
  const platformSub = await db
    .select({ id: userSubscriptions.id })
    .from(userSubscriptions)
    .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, "active"),
        eq(subscriptionPlans.type, "platform"),
      ),
    )
    .limit(1);

  if (platformSub.length > 0) {
    return new Set(creatorIds); // platform patron → subscribed to all
  }

  // Check for active creator-specific subscriptions
  const rows = await db
    .select({ creatorId: subscriptionPlans.creatorId })
    .from(userSubscriptions)
    .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
    .where(
      and(
        eq(userSubscriptions.userId, userId),
        eq(userSubscriptions.status, "active"),
        eq(subscriptionPlans.type, "creator"),
        inArray(subscriptionPlans.creatorId, creatorIds),
      ),
    );

  return new Set(rows.map((r) => r.creatorId).filter((id): id is string => id !== null));
};

const batchGetSubscriberCounts = async (
  creatorIds: string[],
): Promise<Map<string, number>> => {
  if (creatorIds.length === 0) return new Map();
  const rows = await db
    .select({
      creatorId: subscriptionPlans.creatorId,
      count: count(),
    })
    .from(userSubscriptions)
    .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
    .where(
      and(
        eq(subscriptionPlans.type, "creator"),
        eq(userSubscriptions.status, "active"),
        inArray(subscriptionPlans.creatorId, creatorIds),
      ),
    )
    .groupBy(subscriptionPlans.creatorId);
  return new Map(
    rows
      .filter((r): r is typeof r & { creatorId: string } => r.creatorId !== null)
      .map((r) => [r.creatorId, r.count]),
  );
};

const batchGetLastPublished = async (
  creatorIds: string[],
): Promise<Map<string, string>> => {
  if (creatorIds.length === 0) return new Map();
  const rows = await db
    .select({
      creatorId: content.creatorId,
      lastPublished: sql<string>`max(${content.publishedAt})`,
    })
    .from(content)
    .where(
      and(
        inArray(content.creatorId, creatorIds),
        isNull(content.deletedAt),
        isNotNull(content.publishedAt),
      ),
    )
    .groupBy(content.creatorId);
  return new Map(rows.map((r) => [r.creatorId, new Date(r.lastPublished).toISOString()]));
};

const handleImageUpload = async (
  c: Context<AuthEnv>,
  field: "avatar" | "banner",
): Promise<Response> => {
  const identifier = c.req.param("creatorId") ?? "";
  const user = c.get("user");

  // Pre-check Content-Length header before any DB lookup
  const contentLengthHeader = c.req.header("content-length");
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(contentLength) && contentLength > MAX_FILE_SIZES.image) {
      throw new ValidationError(
        `File size exceeds the ${MAX_FILE_SIZES.image} byte limit`,
      );
    }
  }

  // Resolve profile (by UUID or handle)
  const profile = await findCreatorProfile(identifier);
  if (!profile) {
    throw new NotFoundError("Creator profile not found");
  }

  // Permission check using canonical profile ID
  await requireCreatorPermission(user.id, profile.id, "editProfile");

  // Parse multipart body
  const body = await c.req.parseBody();
  const file = body["file"];
  if (!(file instanceof File)) {
    throw new ValidationError("No file provided in 'file' form field");
  }

  // Validate actual file size
  if (file.size > MAX_FILE_SIZES.image) {
    throw new ValidationError(
      `File size ${file.size} exceeds the ${MAX_FILE_SIZES.image} byte limit`,
    );
  }

  // Validate MIME type
  if (!(ACCEPTED_MIME_TYPES.image as readonly string[]).includes(file.type)) {
    throw new ValidationError(
      `Invalid MIME type '${file.type}'. Accepted: ${ACCEPTED_MIME_TYPES.image.join(", ")}`,
    );
  }

  // Generate storage key using canonical profile ID
  const sanitized = sanitizeFilename(file.name || field);
  const key = `creators/${profile.id}/${field}/${sanitized}`;

  // Delete old file if re-uploading
  const oldKey = field === "avatar" ? profile.avatarKey : profile.bannerKey;
  if (oldKey) {
    const deleteResult = await storage.delete(oldKey);
    if (!deleteResult.ok) {
      c.var.logger.warn({ error: deleteResult.error.message, field }, "Failed to delete old file");
    }
  }

  // Upload new file
  const stream = file.stream();
  const uploadResult = await storage.upload(key, stream, {
    contentType: file.type,
    contentLength: file.size,
  });

  if (!uploadResult.ok) {
    throw new AppError("UPLOAD_ERROR", `Failed to upload ${field}`, 500);
  }

  // Update DB with new storage key
  const [updated] = await db
    .update(creatorProfiles)
    .set({
      [field === "avatar" ? "avatarKey" : "bannerKey"]: key,
      updatedAt: new Date(),
    })
    .where(eq(creatorProfiles.id, profile.id))
    .returning();

  if (!updated) {
    throw new NotFoundError("Creator profile not found");
  }

  const contentCount = await getContentCount(profile.id);
  const response = toProfileResponse(updated, contentCount);
  return c.json(response);
};

const handleImageStream = async (
  c: Context,
  field: "avatar" | "banner",
): Promise<Response> => {
  const profile = await findCreatorProfile(c.req.param("creatorId") ?? "");
  const key = field === "avatar" ? profile?.avatarKey : profile?.bannerKey;
  if (!profile || !key) throw new NotFoundError(`${field} not found`);
  return streamFile(c, storage, key, `${field} file not found`);
};

const getMembersResponse = async (
  creatorId: string,
): Promise<{ members: Array<{ userId: string; displayName: string; role: CreatorMemberRole; joinedAt: string }> }> => {
  const allMembers = await db
    .select({
      userId: creatorMembers.userId,
      role: creatorMembers.role,
      joinedAt: creatorMembers.createdAt,
      displayName: users.name,
    })
    .from(creatorMembers)
    .innerJoin(users, eq(creatorMembers.userId, users.id))
    .where(eq(creatorMembers.creatorId, creatorId));

  const members = allMembers.map((m) => ({
    userId: m.userId,
    displayName: m.displayName,
    role: m.role as CreatorMemberRole,
    joinedAt: m.joinedAt.toISOString(),
  }));

  return { members };
};

// ── Public API ──

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

    // Build optional cursor condition for keyset pagination
    let whereCondition:
      | ReturnType<typeof or>
      | ReturnType<typeof and>
      | undefined;

    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "createdAt",
        idField: "id",
      });
      whereCondition = or(
        lt(creatorProfiles.createdAt, decoded.timestamp),
        and(
          eq(creatorProfiles.createdAt, decoded.timestamp),
          lt(creatorProfiles.id, decoded.id),
        ),
      );
    }

    // Query with limit + 1 for next-page detection
    const rows = await db
      .select()
      .from(creatorProfiles)
      .where(whereCondition)
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

// POST / — Create new creator entity
creatorRoutes.post(
  "/",
  requireAuth,
  requireRole("stakeholder", "admin"),
  describeRoute({
    description: "Create a new creator entity (requires stakeholder or admin role)",
    tags: ["creators"],
    responses: {
      201: {
        description: "Creator entity created",
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
  validator("json", CreateCreatorSchema),
  async (c) => {
    const body = c.req.valid("json") as CreateCreator;
    const user = c.get("user");

    // Check handle uniqueness if provided
    if (body.handle) {
      const existing = await db
        .select({ id: creatorProfiles.id })
        .from(creatorProfiles)
        .where(eq(creatorProfiles.handle, body.handle));
      if (existing.length > 0) {
        throw new ValidationError(`Handle '${body.handle}' is already taken`);
      }
    }

    const id = randomUUID();
    const now = new Date();

    const [inserted] = await db
      .insert(creatorProfiles)
      .values({
        id,
        displayName: body.displayName,
        handle: body.handle ?? await generateUniqueSlug(body.displayName, {
          table: creatorProfiles,
          slugColumn: creatorProfiles.handle,
          maxLength: 30,
          fallbackPrefix: "creator",
        }),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!inserted) {
      throw new AppError("INSERT_FAILED", "Failed to create creator profile", 500);
    }

    // Seed owner member row
    await db.insert(creatorMembers).values({
      creatorId: id,
      userId: user.id,
      role: "owner",
      createdAt: now,
    });

    return c.json(toProfileResponse(inserted, 0), 201);
  },
);

// POST /:creatorId/avatar — Upload avatar image
creatorRoutes.post(
  "/:creatorId/avatar",
  requireAuth,
  describeRoute({
    description: "Upload avatar image for a creator profile (owner/editor)",
    tags: ["creators"],
    responses: {
      200: {
        description: "Avatar uploaded, updated creator profile returned",
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
  async (c) => handleImageUpload(c, "avatar"),
);

// POST /:creatorId/banner — Upload banner image
creatorRoutes.post(
  "/:creatorId/banner",
  requireAuth,
  describeRoute({
    description: "Upload banner image for a creator profile (owner/editor)",
    tags: ["creators"],
    responses: {
      200: {
        description: "Banner uploaded, updated creator profile returned",
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
  async (c) => handleImageUpload(c, "banner"),
);

// GET /:creatorId/avatar — Stream avatar image
creatorRoutes.get(
  "/:creatorId/avatar",
  describeRoute({
    description: "Stream the avatar image for a creator",
    tags: ["creators"],
    responses: {
      200: {
        description: "Avatar image stream",
        content: {
          "application/octet-stream": {
            schema: { type: "string", format: "binary" },
          },
        },
      },
      404: ERROR_404,
    },
  }),
  async (c) => handleImageStream(c, "avatar"),
);

// GET /:creatorId/banner — Stream banner image
creatorRoutes.get(
  "/:creatorId/banner",
  describeRoute({
    description: "Stream the banner image for a creator",
    tags: ["creators"],
    responses: {
      200: {
        description: "Banner image stream",
        content: {
          "application/octet-stream": {
            schema: { type: "string", format: "binary" },
          },
        },
      },
      404: ERROR_404,
    },
  }),
  async (c) => handleImageStream(c, "banner"),
);

// GET /:creatorId/members — List members
creatorRoutes.get(
  "/:creatorId/members",
  requireAuth,
  describeRoute({
    description: "List team members for a creator entity",
    tags: ["creators"],
    responses: {
      200: {
        description: "List of creator members",
        content: {
          "application/json": {
            schema: resolver(CreatorMembersResponseSchema),
          },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  async (c) => {
    const creatorId = c.req.param("creatorId");
    const user = c.get("user");

    const profile = await findCreatorProfile(creatorId);
    if (!profile) throw new NotFoundError("Creator not found");

    // Must be a member or admin to view members
    const roles = (c.get("roles") as string[] | undefined) ?? [];
    const isAdmin = roles.includes("admin");
    if (!isAdmin) {
      const memberRows = await db
        .select({ role: creatorMembers.role })
        .from(creatorMembers)
        .where(
          and(
            eq(creatorMembers.creatorId, profile.id),
            eq(creatorMembers.userId, user.id),
          ),
        );
      if (memberRows.length === 0) {
        throw new ForbiddenError("Not a member of this creator");
      }
    }

    return c.json(await getMembersResponse(profile.id));
  },
);

// POST /:creatorId/members — Add member
creatorRoutes.post(
  "/:creatorId/members",
  requireAuth,
  describeRoute({
    description: "Add a member to a creator entity (owner only)",
    tags: ["creators"],
    responses: {
      201: {
        description: "Member added",
        content: {
          "application/json": {
            schema: resolver(CreatorMembersResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("json", AddCreatorMemberSchema),
  async (c) => {
    const creatorId = c.req.param("creatorId");
    const user = c.get("user");
    const body = c.req.valid("json") as AddCreatorMember;
    const roles = (c.get("roles") as string[] | undefined) ?? [];

    const profile = await findCreatorProfile(creatorId);
    if (!profile) throw new NotFoundError("Creator not found");

    await requireCreatorPermission(user.id, profile.id, "manageMembers", roles);

    // Check target user exists
    const targetUser = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, body.userId));
    if (targetUser.length === 0) throw new NotFoundError("User not found");

    // Check not already a member (409)
    const existing = await db
      .select({ role: creatorMembers.role })
      .from(creatorMembers)
      .where(
        and(
          eq(creatorMembers.creatorId, profile.id),
          eq(creatorMembers.userId, body.userId),
        ),
      );
    if (existing.length > 0) {
      throw new ValidationError("User is already a member of this creator");
    }

    await db.insert(creatorMembers).values({
      creatorId: profile.id,
      userId: body.userId,
      role: body.role,
      createdAt: new Date(),
    });

    // Return updated members list
    return c.json(await getMembersResponse(profile.id), 201);
  },
);

// PATCH /:creatorId/members/:memberId — Update member role
creatorRoutes.patch(
  "/:creatorId/members/:memberId",
  requireAuth,
  describeRoute({
    description: "Update a member's role (owner only)",
    tags: ["creators"],
    responses: {
      200: {
        description: "Member role updated",
        content: {
          "application/json": {
            schema: resolver(CreatorMembersResponseSchema),
          },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("json", UpdateCreatorMemberSchema),
  async (c) => {
    const creatorId = c.req.param("creatorId");
    const memberId = c.req.param("memberId");
    const user = c.get("user");
    const body = c.req.valid("json") as UpdateCreatorMember;
    const roles = (c.get("roles") as string[] | undefined) ?? [];

    const profile = await findCreatorProfile(creatorId);
    if (!profile) throw new NotFoundError("Creator not found");

    await requireCreatorPermission(user.id, profile.id, "manageMembers", roles);

    const existing = await db
      .select({ role: creatorMembers.role })
      .from(creatorMembers)
      .where(
        and(
          eq(creatorMembers.creatorId, profile.id),
          eq(creatorMembers.userId, memberId),
        ),
      );
    if (existing.length === 0) throw new NotFoundError("Member not found");

    await db
      .update(creatorMembers)
      .set({ role: body.role })
      .where(
        and(
          eq(creatorMembers.creatorId, profile.id),
          eq(creatorMembers.userId, memberId),
        ),
      );

    return c.json(await getMembersResponse(profile.id));
  },
);

// DELETE /:creatorId/members/:memberId — Remove member
creatorRoutes.delete(
  "/:creatorId/members/:memberId",
  requireAuth,
  describeRoute({
    description: "Remove a member from a creator entity (owner only; cannot remove last owner)",
    tags: ["creators"],
    responses: {
      200: {
        description: "Member removed, updated members list returned",
        content: {
          "application/json": {
            schema: resolver(CreatorMembersResponseSchema),
          },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
      422: { description: "Cannot remove last owner" },
    },
  }),
  async (c) => {
    const creatorId = c.req.param("creatorId");
    const memberId = c.req.param("memberId");
    const user = c.get("user");
    const roles = (c.get("roles") as string[] | undefined) ?? [];

    const profile = await findCreatorProfile(creatorId);
    if (!profile) throw new NotFoundError("Creator not found");

    await requireCreatorPermission(user.id, profile.id, "manageMembers", roles);

    const existing = await db
      .select({ role: creatorMembers.role })
      .from(creatorMembers)
      .where(
        and(
          eq(creatorMembers.creatorId, profile.id),
          eq(creatorMembers.userId, memberId),
        ),
      );
    if (existing.length === 0) throw new NotFoundError("Member not found");

    // Block removal of last owner
    if (existing[0]!.role === "owner") {
      const ownerRows = await db
        .select({ userId: creatorMembers.userId })
        .from(creatorMembers)
        .where(
          and(
            eq(creatorMembers.creatorId, profile.id),
            eq(creatorMembers.role, "owner"),
          ),
        );
      if (ownerRows.length <= 1) {
        throw new ValidationError("Cannot remove the last owner of a creator");
      }
    }

    await db
      .delete(creatorMembers)
      .where(
        and(
          eq(creatorMembers.creatorId, profile.id),
          eq(creatorMembers.userId, memberId),
        ),
      );

    return c.json(await getMembersResponse(profile.id));
  },
);

// GET /:creatorId/members/candidates — Browse eligible users to add as members
creatorRoutes.get(
  "/:creatorId/members/candidates",
  requireAuth,
  describeRoute({
    description: "Browse eligible users to add as creator members (owner only)",
    tags: ["creators"],
    responses: {
      200: {
        description: "List of candidate users",
        content: {
          "application/json": {
            schema: resolver(CandidatesResponseSchema),
          },
        },
      },
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("query", CandidatesQuerySchema),
  async (c) => {
    const creatorId = c.req.param("creatorId");
    const user = c.get("user");
    const { q, limit } = c.req.valid("query" as never) as { q?: string; limit: number };
    const roles = (c.get("roles") as string[] | undefined) ?? [];

    const profile = await findCreatorProfile(creatorId);
    if (!profile) throw new NotFoundError("Creator not found");

    await requireCreatorPermission(user.id, profile.id, "manageMembers", roles);

    // Get existing member user IDs to exclude
    const existingMembers = await db
      .select({ userId: creatorMembers.userId })
      .from(creatorMembers)
      .where(eq(creatorMembers.creatorId, profile.id));
    const excludeIds = existingMembers.map((m) => m.userId);

    // Find users with stakeholder or admin platform roles
    const eligibleUserIds = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(inArray(userRoles.role, ["stakeholder", "admin"]));
    const uniqueEligibleIds = [
      ...new Set(eligibleUserIds.map((r) => r.userId)),
    ].filter((id) => !excludeIds.includes(id));

    if (uniqueEligibleIds.length === 0) {
      return c.json({ candidates: [] });
    }

    // Build conditions: must be in eligible set
    const conditions = [inArray(users.id, uniqueEligibleIds)];

    // Optional search filter
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(ilike(users.name, pattern), ilike(users.email, pattern))!,
      );
    }

    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(...conditions))
      .limit(limit);

    // Batch-fetch roles for matched users
    const userIds = rows.map((r) => r.id);
    const roleRows =
      userIds.length > 0
        ? await db
            .select({ userId: userRoles.userId, role: userRoles.role })
            .from(userRoles)
            .where(inArray(userRoles.userId, userIds))
        : [];
    const roleMap = new Map<string, string[]>();
    for (const r of roleRows) {
      const existing = roleMap.get(r.userId) ?? [];
      existing.push(r.role);
      roleMap.set(r.userId, existing);
    }

    const candidates = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      roles: roleMap.get(r.id) ?? [],
    }));

    return c.json({ candidates });
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
  async (c) => {
    const creatorId = c.req.param("creatorId");
    const profile = await findCreatorProfile(creatorId);

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
  validator("json", UpdateCreatorProfileSchema),
  async (c) => {
    const creatorId = c.req.param("creatorId");
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
