import { and, eq } from "drizzle-orm";

import {
  CREATOR_ROLE_PERMISSIONS,
  ForbiddenError,
} from "@snc/shared";
import type { CreatorMemberRole, CreatorPermission } from "@snc/shared";

import { db } from "../db/connection.js";
import { creatorMembers } from "../db/schema/creator.schema.js";
import { getUserRoles } from "../auth/user-roles.js";

/**
 * Get all creator IDs the user is a member of (with roles).
 */
export const getCreatorMemberships = async (
  userId: string,
): Promise<Array<{ creatorId: string; role: CreatorMemberRole }>> => {
  const rows = await db
    .select({ creatorId: creatorMembers.creatorId, role: creatorMembers.role })
    .from(creatorMembers)
    .where(eq(creatorMembers.userId, userId));
  return rows as Array<{ creatorId: string; role: CreatorMemberRole }>;
};

/**
 * Check whether a user has a specific permission for a creator entity.
 * Admin platform-role bypasses all checks.
 */
export const checkCreatorPermission = async (
  userId: string,
  creatorId: string,
  permission: CreatorPermission,
  userRoles?: string[],
): Promise<boolean> => {
  const roles = userRoles ?? await getUserRoles(userId);
  if (roles.includes("admin")) return true;

  const rows = await db
    .select({ role: creatorMembers.role })
    .from(creatorMembers)
    .where(
      and(
        eq(creatorMembers.userId, userId),
        eq(creatorMembers.creatorId, creatorId),
      ),
    );

  if (rows.length === 0) return false;
  const role = rows[0]!.role as CreatorMemberRole;
  return CREATOR_ROLE_PERMISSIONS[role][permission] === true;
};

/**
 * Throw ForbiddenError if the user does not have the given permission.
 */
export const requireCreatorPermission = async (
  userId: string,
  creatorId: string,
  permission: CreatorPermission,
  userRoles?: string[],
): Promise<void> => {
  const allowed = await checkCreatorPermission(
    userId,
    creatorId,
    permission,
    userRoles,
  );
  if (!allowed) {
    throw new ForbiddenError(`Missing creator permission: ${permission}`);
  }
};
