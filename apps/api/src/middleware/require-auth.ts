import type { MiddlewareHandler } from "hono";

import { UnauthorizedError } from "@snc/shared";

import { auth } from "../auth/auth.js";
import { getUserRoles } from "../auth/user-roles.js";
import { rootLogger } from "../logging/logger.js";

import type { AuthEnv } from "./auth-env.js";

// ── Public API ──

/**
 * Hono middleware that validates the session from the request headers
 * via Better Auth's session API. Sets `user`, `session`, and `roles`
 * on the Hono context if valid; throws `UnauthorizedError` (401) if not.
 *
 * Usage: `app.get("/protected", requireAuth, handler)`
 */
export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    const logger = c.var?.logger ?? rootLogger;
    logger.warn(
      {
        event: "auth_failure",
        path: c.req.path,
        method: c.req.method,
      },
      "Authentication failed — no valid session",
    );
    throw new UnauthorizedError();
  }

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

  await next();
};
