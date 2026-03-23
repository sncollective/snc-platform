import type { Role, Session, User } from "@snc/shared";

import { auth } from "../auth/auth.js";
import { getUserRoles } from "../auth/user-roles.js";

// ── Private Types ──

type RawSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

// ── Public API ──

/**
 * Normalizes a Better Auth session into the shaped User/Session/roles
 * values expected by Hono context (AuthEnv / OptionalAuthEnv).
 *
 * Converts Date objects to ISO strings and normalizes image to null.
 */
export async function hydrateAuthContext(
  rawSession: RawSession,
): Promise<{ user: User; session: Session; roles: Role[] }> {
  const roles = await getUserRoles(rawSession.user.id);
  return {
    user: {
      ...rawSession.user,
      image: rawSession.user.image ?? null,
      createdAt: rawSession.user.createdAt.toISOString(),
      updatedAt: rawSession.user.updatedAt.toISOString(),
    } as User,
    session: {
      ...rawSession.session,
      expiresAt: rawSession.session.expiresAt.toISOString(),
    } as Session,
    roles,
  };
}
