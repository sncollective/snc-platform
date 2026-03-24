import { Hono } from "hono";
import type { Context } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, and, or, inArray, ilike } from "drizzle-orm";

import {
  AddCreatorMemberSchema,
  UpdateCreatorMemberSchema,
  CreatorMembersResponseSchema,
  CandidatesQuerySchema,
  CandidatesResponseSchema,
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "@snc/shared";
import type {
  AddCreatorMember,
  UpdateCreatorMember,
  CreatorMemberRole,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorProfiles, creatorMembers } from "../db/schema/creator.schema.js";
import { users, userRoles } from "../db/schema/user.schema.js";
import { requireAuth } from "../middleware/require-auth.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import { ERROR_400, ERROR_401, ERROR_403, ERROR_404 } from "../lib/openapi-errors.js";
import { batchGetUserRoles } from "../auth/user-roles.js";
import { requireCreatorPermission } from "../services/creator-team.js";
import { toISO } from "../lib/response-helpers.js";
import { CreatorIdParam, CreatorMemberParams } from "./route-params.js";

// ── Private Helpers ──

const findCreatorProfile = async (
  identifier: string,
): Promise<(typeof creatorProfiles.$inferSelect) | undefined> => {
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
    role: m.role,
    joinedAt: toISO(m.joinedAt),
  }));

  return { members };
};

const getRoles = (c: Context<AuthEnv>): string[] =>
  (c.get("roles") as string[] | undefined) ?? [];

// ── Public API ──

export const creatorMemberRoutes = new Hono<AuthEnv>();

// GET /:creatorId/members — List members
creatorMemberRoutes.get(
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
  validator("param", CreatorIdParam),
  async (c) => {
    const { creatorId } = c.req.valid("param" as never) as { creatorId: string };
    const user = c.get("user");

    const profile = await findCreatorProfile(creatorId);
    if (!profile) throw new NotFoundError("Creator not found");

    // Must be a member or admin to view members
    const roles = getRoles(c);
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
creatorMemberRoutes.post(
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
  validator("param", CreatorIdParam),
  validator("json", AddCreatorMemberSchema),
  async (c) => {
    const { creatorId } = c.req.valid("param" as never) as { creatorId: string };
    const user = c.get("user");
    const body = c.req.valid("json") as AddCreatorMember;
    const roles = getRoles(c);

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
creatorMemberRoutes.patch(
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
  validator("param", CreatorMemberParams),
  validator("json", UpdateCreatorMemberSchema),
  async (c) => {
    const { creatorId, memberId } = c.req.valid("param" as never) as { creatorId: string; memberId: string };
    const user = c.get("user");
    const body = c.req.valid("json") as UpdateCreatorMember;
    const roles = getRoles(c);

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
creatorMemberRoutes.delete(
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
  validator("param", CreatorMemberParams),
  async (c) => {
    const { creatorId, memberId } = c.req.valid("param" as never) as { creatorId: string; memberId: string };
    const user = c.get("user");
    const roles = getRoles(c);

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
creatorMemberRoutes.get(
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
  validator("param", CreatorIdParam),
  validator("query", CandidatesQuerySchema),
  async (c) => {
    const { creatorId } = c.req.valid("param" as never) as { creatorId: string };
    const user = c.get("user");
    const { q, limit } = c.req.valid("query" as never) as { q?: string; limit: number };
    const roles = getRoles(c);

    const profile = await findCreatorProfile(creatorId);
    if (!profile) throw new NotFoundError("Creator not found");

    await requireCreatorPermission(user.id, profile.id, "manageMembers", roles);

    // Fetch existing members and eligible user IDs concurrently (independent queries)
    const [existingMembers, eligibleUserIds] = await Promise.all([
      db
        .select({ userId: creatorMembers.userId })
        .from(creatorMembers)
        .where(eq(creatorMembers.creatorId, profile.id)),
      db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .where(inArray(userRoles.role, ["stakeholder", "admin"])),
    ]);
    const excludeIds = existingMembers.map((m) => m.userId);
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
    const roleMap = await batchGetUserRoles(rows.map((r) => r.id));

    const candidates = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      roles: roleMap.get(r.id) ?? [],
    }));

    return c.json({ candidates });
  },
);
