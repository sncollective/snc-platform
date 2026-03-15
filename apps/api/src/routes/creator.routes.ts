import { Hono } from "hono";
import type { Context } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, and, isNull, isNotNull, desc, lt, or, count, inArray } from "drizzle-orm";

import {
  CreatorProfileResponseSchema,
  CreatorListQuerySchema,
  CreatorListResponseSchema,
  UpdateCreatorProfileSchema,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  AppError,
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZES,
  HANDLE_REGEX,
} from "@snc/shared";
import type {
  CreatorProfileResponse,
  CreatorListQuery,
  UpdateCreatorProfile,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { content } from "../db/schema/content.schema.js";
import { users, userRoles } from "../db/schema/user.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import { storage } from "../storage/index.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "./openapi-errors.js";
import { sanitizeFilename, streamFile } from "./file-utils.js";
import { buildPaginatedResponse, decodeCursor } from "./cursor.js";

// ── Private Types ──

type CreatorProfileRow = typeof creatorProfiles.$inferSelect;

// ── Private Helpers ──

const resolveCreatorUrls = (
  profile: CreatorProfileRow,
): { avatarUrl: string | null; bannerUrl: string | null } => ({
  avatarUrl: profile.avatarKey
    ? `/api/creators/${profile.userId}/avatar`
    : null,
  bannerUrl: profile.bannerKey
    ? `/api/creators/${profile.userId}/banner`
    : null,
});

const findCreatorProfile = async (
  creatorId: string,
): Promise<CreatorProfileRow | undefined> => {
  const rows = await db
    .select()
    .from(creatorProfiles)
    .where(eq(creatorProfiles.userId, creatorId));
  return rows[0];
};

type CreatorProfileInsert = typeof creatorProfiles.$inferInsert;

const ensureCreatorProfile = async (
  userId: string,
  userName: string,
  overrides?: Partial<Pick<CreatorProfileInsert, "bio" | "socialLinks">>,
): Promise<CreatorProfileRow> => {
  const now = new Date();
  const [inserted] = await db
    .insert(creatorProfiles)
    .values({
      userId,
      displayName: userName,
      ...overrides,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning();

  // If onConflictDoNothing returned nothing, the profile was concurrently
  // created — re-fetch it
  if (!inserted) {
    const existing = await findCreatorProfile(userId);
    if (!existing) {
      throw new NotFoundError("Creator not found");
    }
    return existing;
  }

  return inserted;
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

const hasCreatorRole = async (userId: string): Promise<boolean> => {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, "creator")));
  return rows.length > 0;
};

const toProfileResponse = (
  profile: CreatorProfileRow,
  contentCount: number,
): CreatorProfileResponse => {
  const urls = resolveCreatorUrls(profile);
  return {
    userId: profile.userId,
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
  const creatorId = c.req.param("creatorId");
  const user = c.get("user");

  // Ownership check
  if (creatorId !== user.id) {
    throw new ForbiddenError("Cannot upload to another creator's profile");
  }

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

  // Ensure profile exists (upsert: create if first upload)
  let profile = await findCreatorProfile(creatorId);
  if (!profile) {
    profile = await ensureCreatorProfile(creatorId, user.name);
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
    .where(eq(creatorProfiles.userId, creatorId))
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
        idField: "userId",
      });
      whereCondition = or(
        lt(creatorProfiles.createdAt, decoded.timestamp),
        and(
          eq(creatorProfiles.createdAt, decoded.timestamp),
          lt(creatorProfiles.userId, decoded.id),
        ),
      );
    }

    // Query with limit + 1 for next-page detection
    const rows = await db
      .select()
      .from(creatorProfiles)
      .where(whereCondition)
      .orderBy(desc(creatorProfiles.createdAt), desc(creatorProfiles.userId))
      .limit(limit + 1);

    const { items: rawRows, nextCursor } = buildPaginatedResponse(
      rows,
      limit,
      (last) => ({
        createdAt: last.createdAt.toISOString(),
        userId: last.userId,
      }),
    );

    // Batch-fetch content counts to avoid N+1 queries
    const countMap = await batchGetContentCounts(rawRows.map((r) => r.userId));
    const items = rawRows.map((row) =>
      toProfileResponse(row, countMap.get(row.userId) ?? 0),
    );

    return c.json({ items, nextCursor });
  },
);

// POST /:creatorId/avatar — Upload avatar image
creatorRoutes.post(
  "/:creatorId/avatar",
  requireAuth,
  requireRole("creator"),
  describeRoute({
    description: "Upload avatar image for own creator profile",
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
  requireRole("creator"),
  describeRoute({
    description: "Upload banner image for own creator profile",
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

// GET /:creatorId — Get creator profile
creatorRoutes.get(
  "/:creatorId",
  describeRoute({
    description: "Get a creator profile by user ID",
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

    // Try to find existing profile
    let profile = await findCreatorProfile(creatorId);

    if (!profile) {
      // Check if user exists and has creator role for lazy initialization
      const userRows = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, creatorId));

      const user = userRows[0];
      if (!user) {
        throw new NotFoundError("Creator not found");
      }

      const isCreator = await hasCreatorRole(creatorId);
      if (!isCreator) {
        throw new NotFoundError("Creator not found");
      }

      // Lazily create profile
      profile = await ensureCreatorProfile(user.id, user.name);
    }

    const contentCount = await getContentCount(creatorId);
    const response = toProfileResponse(profile, contentCount);
    return c.json(response);
  },
);

// PATCH /:creatorId — Update own creator profile
creatorRoutes.patch(
  "/:creatorId",
  requireAuth,
  requireRole("creator"),
  describeRoute({
    description: "Update own creator profile",
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

    // Ownership check
    if (creatorId !== user.id) {
      throw new ForbiddenError("Cannot update another creator's profile");
    }

    // Upsert: update if exists, create if not
    let profile = await findCreatorProfile(creatorId);

    if (profile) {
      // Validate handle uniqueness before update (catch DB constraint with a clear error)
      if (body.handle && body.handle !== profile.handle) {
        const existing = await db
          .select({ userId: creatorProfiles.userId })
          .from(creatorProfiles)
          .where(eq(creatorProfiles.handle, body.handle));
        if (existing.length > 0) {
          throw new ValidationError(
            `Handle '${body.handle}' is already taken`,
          );
        }
      }

      const updateData = {
        ...body,
        updatedAt: new Date(),
      };

      // Update existing profile
      const [updated] = await db
        .update(creatorProfiles)
        .set(updateData)
        .where(eq(creatorProfiles.userId, creatorId))
        .returning();

      if (!updated) {
        throw new NotFoundError("Creator profile not found");
      }
      profile = updated;
    } else {
      // Create new profile (upsert behavior) — delegate to ensureCreatorProfile
      // so conflict handling and the re-fetch guard are applied consistently
      profile = await ensureCreatorProfile(
        creatorId,
        body.displayName ?? user.name,
        {
          bio: body.bio ?? null,
          socialLinks: body.socialLinks ?? [],
        },
      );
    }

    const contentCount = await getContentCount(creatorId);
    const response = toProfileResponse(profile, contentCount);
    return c.json(response);
  },
);
