import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import type { Context } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, and, isNull, isNotNull, desc, lt, or, count, inArray } from "drizzle-orm";

import {
  CreatorProfileResponseSchema,
  CreatorListQuerySchema,
  CreatorListResponseSchema,
  UpdateCreatorProfileSchema,
  CreateCreatorSchema,
  AddCreatorMemberSchema,
  UpdateCreatorMemberSchema,
  CreatorMembersResponseSchema,
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
import { users } from "../db/schema/user.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import { storage } from "../storage/index.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "./openapi-errors.js";
import { sanitizeFilename, streamFile } from "./file-utils.js";
import { buildPaginatedResponse, decodeCursor } from "./cursor.js";
import { requireCreatorPermission, getCreatorMemberships } from "../services/creator-team.js";

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
  creatorId: string,
): Promise<CreatorProfileRow | undefined> => {
  const rows = await db
    .select()
    .from(creatorProfiles)
    .where(eq(creatorProfiles.id, creatorId));
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

const handleImageUpload = async (
  c: Context<AuthEnv>,
  field: "avatar" | "banner",
): Promise<Response> => {
  const creatorId = c.req.param("creatorId") ?? "";
  const user = c.get("user");

  // Permission check
  await requireCreatorPermission(user.id, creatorId, "editProfile");

  // Pre-check Content-Length header
  const contentLengthHeader = c.req.header("content-length");
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(contentLength) && contentLength > MAX_FILE_SIZES.image) {
      throw new ValidationError(
        `File size exceeds the ${MAX_FILE_SIZES.image} byte limit`,
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

  // Generate storage key
  const sanitized = sanitizeFilename(file.name || field);
  const key = `creators/${creatorId}/${field}/${sanitized}`;

  // Ensure profile exists
  const profile = await findCreatorProfile(creatorId);
  if (!profile) {
    throw new NotFoundError("Creator profile not found");
  }

  // Delete old file if re-uploading
  const oldKey = field === "avatar" ? profile.avatarKey : profile.bannerKey;
  if (oldKey) {
    const deleteResult = await storage.delete(oldKey);
    if (!deleteResult.ok) {
      console.error(
        `Failed to delete old ${field}:`,
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
    throw new AppError("UPLOAD_ERROR", `Failed to upload ${field}`, 500);
  }

  // Update DB with new storage key
  const [updated] = await db
    .update(creatorProfiles)
    .set({
      [field === "avatar" ? "avatarKey" : "bannerKey"]: key,
      updatedAt: new Date(),
    })
    .where(eq(creatorProfiles.id, creatorId))
    .returning();

  if (!updated) {
    throw new NotFoundError("Creator profile not found");
  }

  const contentCount = await getContentCount(creatorId);
  const response = toProfileResponse(updated, contentCount);
  return c.json(response);
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

    return c.json({ items, nextCursor });
  },
);

// POST / — Create new creator entity
creatorRoutes.post(
  "/",
  requireAuth,
  requireRole("creator"),
  describeRoute({
    description: "Create a new creator entity (requires creator platform role)",
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
        ownerId: user.id,
        displayName: body.displayName,
        handle: body.handle ?? null,
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

// GET /mine — List creator entities the user is a member of
creatorRoutes.get(
  "/mine",
  requireAuth,
  describeRoute({
    description: "List creator entities the authenticated user is a member of",
    tags: ["creators"],
    responses: {
      200: {
        description: "List of creator profiles",
        content: {
          "application/json": {
            schema: resolver(CreatorListResponseSchema),
          },
        },
      },
      401: ERROR_401,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const memberships = await getCreatorMemberships(user.id);

    if (memberships.length === 0) {
      return c.json({ items: [], nextCursor: null });
    }

    const creatorIds = memberships.map((m) => m.creatorId);
    const profiles = await db
      .select()
      .from(creatorProfiles)
      .where(inArray(creatorProfiles.id, creatorIds));

    const countMap = await batchGetContentCounts(creatorIds);
    const items = profiles.map((p) =>
      toProfileResponse(p, countMap.get(p.id) ?? 0),
    );

    return c.json({ items, nextCursor: null });
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
  async (c) => {
    const creatorId = c.req.param("creatorId");

    const profile = await findCreatorProfile(creatorId);
    if (!profile || !profile.avatarKey) {
      throw new NotFoundError("Avatar not found");
    }

    return streamFile(c, storage, profile.avatarKey, "Avatar file not found");
  },
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
  async (c) => {
    const creatorId = c.req.param("creatorId");

    const profile = await findCreatorProfile(creatorId);
    if (!profile || !profile.bannerKey) {
      throw new NotFoundError("Banner not found");
    }

    return streamFile(c, storage, profile.bannerKey, "Banner file not found");
  },
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

    // Must be a member to view members
    const memberRows = await db
      .select({ role: creatorMembers.role })
      .from(creatorMembers)
      .where(
        and(
          eq(creatorMembers.creatorId, creatorId),
          eq(creatorMembers.userId, user.id),
        ),
      );
    if (memberRows.length === 0) {
      throw new ForbiddenError("Not a member of this creator");
    }

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

    return c.json({ members });
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

    const profile = await findCreatorProfile(creatorId);
    if (!profile) throw new NotFoundError("Creator not found");

    await requireCreatorPermission(user.id, creatorId, "manageMembers");

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
          eq(creatorMembers.creatorId, creatorId),
          eq(creatorMembers.userId, body.userId),
        ),
      );
    if (existing.length > 0) {
      throw new ValidationError("User is already a member of this creator");
    }

    await db.insert(creatorMembers).values({
      creatorId,
      userId: body.userId,
      role: body.role,
      createdAt: new Date(),
    });

    // Return updated members list
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

    return c.json({ members }, 201);
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

    const profile = await findCreatorProfile(creatorId);
    if (!profile) throw new NotFoundError("Creator not found");

    await requireCreatorPermission(user.id, creatorId, "manageMembers");

    const existing = await db
      .select({ role: creatorMembers.role })
      .from(creatorMembers)
      .where(
        and(
          eq(creatorMembers.creatorId, creatorId),
          eq(creatorMembers.userId, memberId),
        ),
      );
    if (existing.length === 0) throw new NotFoundError("Member not found");

    await db
      .update(creatorMembers)
      .set({ role: body.role })
      .where(
        and(
          eq(creatorMembers.creatorId, creatorId),
          eq(creatorMembers.userId, memberId),
        ),
      );

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

    return c.json({ members });
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

    const profile = await findCreatorProfile(creatorId);
    if (!profile) throw new NotFoundError("Creator not found");

    await requireCreatorPermission(user.id, creatorId, "manageMembers");

    const existing = await db
      .select({ role: creatorMembers.role })
      .from(creatorMembers)
      .where(
        and(
          eq(creatorMembers.creatorId, creatorId),
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
            eq(creatorMembers.creatorId, creatorId),
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
          eq(creatorMembers.creatorId, creatorId),
          eq(creatorMembers.userId, memberId),
        ),
      );

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

    return c.json({ members });
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

    const contentCount = await getContentCount(creatorId);
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

    await requireCreatorPermission(user.id, creatorId, "editProfile");

    const profile = await findCreatorProfile(creatorId);
    if (!profile) {
      throw new NotFoundError("Creator profile not found");
    }

    // Validate handle uniqueness before update
    if (body.handle && body.handle !== profile.handle) {
      const existing = await db
        .select({ id: creatorProfiles.id })
        .from(creatorProfiles)
        .where(eq(creatorProfiles.handle, body.handle));
      if (existing.length > 0) {
        throw new ValidationError(`Handle '${body.handle}' is already taken`);
      }
    }

    const [updated] = await db
      .update(creatorProfiles)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(creatorProfiles.id, creatorId))
      .returning();

    if (!updated) {
      throw new NotFoundError("Creator profile not found");
    }

    const contentCount = await getContentCount(creatorId);
    const response = toProfileResponse(updated, contentCount);
    return c.json(response);
  },
);
