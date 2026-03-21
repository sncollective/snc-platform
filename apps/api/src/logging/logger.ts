import pino from "pino";
import type { DestinationStream } from "pino";

import { config } from "../config.js";
import type { Config } from "../config.js";

// ── Public Types ──

export type { Logger } from "pino";

// ── Private Helpers ──

const buildLoggerOptions = (cfg: Pick<Config, "LOG_LEVEL">): pino.LoggerOptions => {
  const opts: pino.LoggerOptions = {
    level: cfg.LOG_LEVEL,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        'req.headers["x-api-key"]',
      ],
      censor: "[REDACTED]",
    },
  };

  if (process.env.NODE_ENV === "development") {
    opts.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "hostname,pid",
      },
    };
  }

  return opts;
};

// ── Public API ──

/**
 * Create a pino logger instance from application config.
 * Exported for test injection — pass a DestinationStream to capture output in tests.
 */
export const createRootLogger = (
  cfg: Pick<Config, "LOG_LEVEL">,
  destination?: DestinationStream,
): pino.Logger => {
  const opts = buildLoggerOptions(cfg);
  return destination ? pino(opts, destination) : pino(opts);
};

/**
 * Root logger singleton for non-request contexts (startup, shutdown, scripts).
 * For request-scoped logging, use `c.var.logger` from the hono-pino middleware.
 */
export const rootLogger: pino.Logger = createRootLogger(config);
