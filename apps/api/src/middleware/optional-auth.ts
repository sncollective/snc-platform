import type { MiddlewareHandler } from "hono";

import type { User, Session, Role } from "@snc/shared";

import { auth } from "../auth/auth.js";
import { getUserRoles } from "../auth/user-roles.js";

// ── Public Types ──

/**
 * Hono environment type for routes that optionally resolve auth.
 * Use as the generic parameter on route handlers to get typed
 * `c.get("user")`, `c.get("session")`, and `c.get("roles")`.
 *
 * Unlike `AuthEnv`, `user` and `session` may be `null` when no
 * valid session exists. `roles` is always an array (empty when
 * unauthenticated) for easier consumption.
 */
export type OptionalAuthEnv = {
  Variables: {
    user: User | null;
    session: Session | null;
    roles: Role[];
  };
};

// ── Public API ──

/**
 * Hono middleware that attempts to resolve a session from request
 * headers via Better Auth's session API. Sets `user`, `session`,
 * and `roles` on the Hono context if a valid session exists;
 * sets `null`/empty values otherwise. Never throws — always
 * calls `next()`.
 *
 * Usage: `app.get("/public-with-context", optionalAuth, handler)`
 */
export const optionalAuth: MiddlewareHandler<OptionalAuthEnv> = async (
  c,
  next,
) => {
  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;

  try {
    session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
  } catch {
    // Graceful degradation — treat resolution errors as unauthenticated.
  }

  if (session) {
    c.set("user", {
      ...session.user,
      image: session.user.image ?? null,
      createdAt: session.user.createdAt.toISOString(),
      updatedAt: session.user.updatedAt.toISOString(),
    });
    c.set("session", {
      ...session.session,
      expiresAt: session.session.expiresAt.toISOString(),
    });

    const roles = await getUserRoles(session.user.id);
    c.set("roles", roles);
  } else {
    c.set("user", null);
    c.set("session", null);
    c.set("roles", []);
  }

  await next();
};
