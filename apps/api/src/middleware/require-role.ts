import type { MiddlewareHandler } from "hono";

import type { Role } from "@snc/shared";
import { ForbiddenError, UnauthorizedError } from "@snc/shared";

import { getClientIp } from "../lib/request-helpers.js";
import { rootLogger } from "../logging/logger.js";

import type { AuthEnv } from "./auth-env.js";

// ── Public API ──

/**
 * Middleware factory that checks if the authenticated user holds at least
 * one of the specified roles. Reads `roles` from context (set by
 * `requireAuth`) and throws `ForbiddenError` (403) if the user lacks
 * all required roles.
 *
 * Must be chained after `requireAuth` (reads `user` and `roles` from context).
 *
 * Usage: `app.post("/path", requireAuth, requireRole("stakeholder"), handler)`
 */
export const requireRole = (
  ...roles: readonly Role[]
): MiddlewareHandler<AuthEnv> => {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) {
      throw new UnauthorizedError();
    }
    const userRoleValues = c.get("roles");

    const hasRole = roles.some((required) =>
      userRoleValues.includes(required),
    );

    if (!hasRole) {
      const logger = c.var?.logger ?? rootLogger;
      logger.warn(
        {
          event: "authz_denial",
          userId: user.id,
          requiredRoles: roles,
          userRoles: userRoleValues,
          path: c.req.path,
          method: c.req.method,
          ip: getClientIp(c),
        },
        "Authorization denied — insufficient permissions",
      );
      throw new ForbiddenError("Insufficient permissions");
    }

    await next();
  };
};
