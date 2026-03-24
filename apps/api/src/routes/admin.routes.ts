import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { eq, desc, lt, or, and, inArray, type SQL } from "drizzle-orm";

import {
  AdminUsersQuerySchema,
  AdminUsersResponseSchema,
  AdminUserResponseSchema,
  AssignRoleRequestSchema,
  RevokeRoleRequestSchema,
  NotFoundError,
  ForbiddenError,
} from "@snc/shared";
import type { AdminUsersQuery, AdminUser, Role } from "@snc/shared";

import { db } from "../db/connection.js";
import { users, userRoles } from "../db/schema/user.schema.js";
import { batchGetUserRoles, getUserRoles } from "../auth/user-roles.js";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import type { AuthEnv } from "../middleware/auth-env.js";
import {
  ERROR_400,
  ERROR_401,
  ERROR_403,
  ERROR_404,
} from "../lib/openapi-errors.js";
import { buildCursorCondition, buildPaginatedResponse, decodeCursor } from "../lib/cursor.js";
import { toISO } from "../lib/response-helpers.js";
import { UserIdParam } from "./route-params.js";
import { rootLogger } from "../logging/logger.js";

// ── Private Types ──

type UserRow = typeof users.$inferSelect;

// ── Private Helpers ──

const toAdminUserResponse = (
  row: UserRow,
  roles: Role[],
): AdminUser => ({
  id: row.id,
  name: row.name,
  email: row.email,
  emailVerified: row.emailVerified,
  image: row.image,
  createdAt: toISO(row.createdAt),
  updatedAt: toISO(row.updatedAt),
  roles,
});

async function getUserWithRoles(userId: string): Promise<AdminUser | null> {
  const [[user], roles] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    getUserRoles(userId),
  ]);

  if (!user) return null;

  return toAdminUserResponse(user, roles);
}

// ── Public API ──

export const adminRoutes = new Hono<AuthEnv>();

// GET /users — List all users with roles (cursor-paginated)

adminRoutes.get(
  "/users",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "List all users with their roles (admin only)",
    tags: ["admin"],
    responses: {
      200: {
        description: "Paginated user list",
        content: {
          "application/json": { schema: resolver(AdminUsersResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
    },
  }),
  validator("query", AdminUsersQuerySchema),
  async (c) => {
    const { limit, cursor } =
      c.req.valid("query" as never) as AdminUsersQuery;

    const conditions: SQL[] = [];

    if (cursor) {
      const decoded = decodeCursor(cursor, {
        timestampField: "createdAt",
        idField: "id",
      });
      conditions.push(
        buildCursorCondition(users.createdAt, users.id, decoded, "desc"),
      );
    }

    const userRows = await db
      .select()
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(limit + 1);

    const { items: pagedUsers, nextCursor } = buildPaginatedResponse(
      userRows,
      limit,
      (last) => ({
        createdAt: last.createdAt.toISOString(),
        id: last.id,
      }),
    );

    const rolesMap = await batchGetUserRoles(pagedUsers.map((u) => u.id));

    const usersWithRoles: AdminUser[] = pagedUsers.map((u) =>
      toAdminUserResponse(u, rolesMap.get(u.id) ?? []),
    );

    return c.json({ items: usersWithRoles, nextCursor });
  },
);

// POST /users/:userId/roles — Assign a role

adminRoutes.post(
  "/users/:userId/roles",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "Assign a role to a user (admin only, idempotent)",
    tags: ["admin"],
    responses: {
      200: {
        description: "User with updated roles",
        content: {
          "application/json": { schema: resolver(AdminUserResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", UserIdParam),
  validator("json", AssignRoleRequestSchema),
  async (c) => {
    const { userId } = c.req.valid("param" as never) as { userId: string };
    const { role } = c.req.valid("json" as never) as { role: Role };
    const actor = c.get("user");

    // Idempotent insert
    await db
      .insert(userRoles)
      .values({ userId, role })
      .onConflictDoNothing();

    const user = await getUserWithRoles(userId);
    if (!user) throw new NotFoundError("User not found");

    const logger = c.var?.logger ?? rootLogger;
    logger.info(
      {
        event: "role_assigned",
        actorId: actor.id,
        targetUserId: userId,
        role,
        ip: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? null,
      },
      "Admin assigned role",
    );

    return c.json({ user });
  },
);

// DELETE /users/:userId/roles — Revoke a role

adminRoutes.delete(
  "/users/:userId/roles",
  requireAuth,
  requireRole("admin"),
  describeRoute({
    description: "Revoke a role from a user (admin only)",
    tags: ["admin"],
    responses: {
      200: {
        description: "User with updated roles",
        content: {
          "application/json": { schema: resolver(AdminUserResponseSchema) },
        },
      },
      400: ERROR_400,
      401: ERROR_401,
      403: ERROR_403,
      404: ERROR_404,
    },
  }),
  validator("param", UserIdParam),
  validator("json", RevokeRoleRequestSchema),
  async (c) => {
    const { userId } = c.req.valid("param" as never) as { userId: string };
    const { role } = c.req.valid("json" as never) as { role: Role };
    const currentUser = c.get("user");

    // Self-protection: cannot remove own admin role
    if (userId === currentUser.id && role === "admin") {
      throw new ForbiddenError("Cannot remove your own admin role");
    }

    await db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));

    const user = await getUserWithRoles(userId);
    if (!user) throw new NotFoundError("User not found");

    const logger = c.var?.logger ?? rootLogger;
    logger.info(
      {
        event: "role_revoked",
        actorId: currentUser.id,
        targetUserId: userId,
        role,
        ip: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? null,
      },
      "Admin revoked role",
    );

    return c.json({ user });
  },
);
