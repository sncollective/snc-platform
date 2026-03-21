import { pinoLogger } from "hono-pino";
import { requestId } from "hono/request-id";

import { rootLogger } from "../logging/logger.js";

// ── Private Helpers ──

/** Safely extract userId from Hono context — returns undefined if auth middleware didn't run. */
const getUserId = (c: { get: (key: string) => unknown }): string | undefined => {
  const user = c.get("user") as { id: string } | undefined;
  return user?.id;
};

// ── Public API ──

/**
 * Request ID middleware — reads x-request-id header or generates a UUID.
 * Must run before requestLogger so hono-pino can pick up the request ID.
 */
export const requestIdMiddleware = requestId();

/**
 * Request logging middleware using hono-pino.
 *
 * Sets `c.var.logger` — a pino child logger scoped to the current request
 * with requestId, method, path, and response timing.
 *
 * Uses `referRequestIdKey: "requestId"` to pick up the ID set by
 * `requestIdMiddleware` (which reads x-request-id or generates a UUID).
 *
 * Auth context (userId) is enriched in response bindings
 * after auth middleware has run.
 */
export const requestLogger = pinoLogger({
  pino: rootLogger,
  http: {
    referRequestIdKey: "requestId",
    onReqBindings: (c) => ({
      method: c.req.method,
      path: c.req.path,
      userAgent: c.req.header("user-agent"),
    }),
    onResBindings: (c) => ({
      statusCode: c.res.status,
      userId: getUserId(c),
    }),
    responseTime: true,
  },
});
