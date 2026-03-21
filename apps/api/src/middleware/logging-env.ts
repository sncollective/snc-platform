import type { PinoLogger } from "hono-pino";

// ── Public Types ──

/**
 * Hono environment type for routes with logging middleware.
 * Use as the generic parameter on route handlers to get typed `c.var.logger`.
 */
export type LoggingEnv = {
  Variables: {
    logger: PinoLogger;
  };
};
