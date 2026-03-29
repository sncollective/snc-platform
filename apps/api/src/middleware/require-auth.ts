import type { MiddlewareHandler } from "hono";

import { UnauthorizedError } from "@snc/shared";

import { auth } from "../auth/auth.js";
import { rootLogger } from "../logging/logger.js";

import { getClientIp } from "../lib/request-helpers.js";
import type { AuthEnv } from "./auth-env.js";
import { hydrateAuthContext } from "./auth-helpers.js";

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
        ip: getClientIp(c),
      },
      "Authentication failed — no valid session",
    );
    throw new UnauthorizedError();
  }

  const hydrated = await hydrateAuthContext(session);
  c.set("user", hydrated.user);
  c.set("session", hydrated.session);
  c.set("roles", hydrated.roles);

  await next();
};
