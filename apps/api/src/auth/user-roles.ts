import { eq, inArray } from "drizzle-orm";

import type { Role } from "@snc/shared";

import { db } from "../db/connection.js";
import { userRoles } from "../db/schema/user.schema.js";

// ── Public API ──

/** Fetch all roles assigned to a user. */
export const getUserRoles = async (userId: string): Promise<Role[]> => {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));

  return rows.map((r) => r.role);
};

/** Fetch roles for multiple users in a single query. */
export async function batchGetUserRoles(
  userIds: string[],
): Promise<Map<string, Role[]>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: userRoles.userId, role: userRoles.role })
    .from(userRoles)
    .where(inArray(userRoles.userId, userIds));
  const map = new Map<string, Role[]>();
  for (const row of rows) {
    const existing = map.get(row.userId) ?? [];
    existing.push(row.role);
    map.set(row.userId, existing);
  }
  return map;
}
