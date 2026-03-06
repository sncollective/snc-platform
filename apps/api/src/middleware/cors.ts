import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";

import { config, parseOrigins } from "../config.js";

// ── Public API ──

/**
 * Factory that creates a CORS middleware for the given origin(s).
 *
 * Tests can call this directly with a known origin without mocking config.
 */
export const createCorsMiddleware = (
  origin: string | string[],
): MiddlewareHandler =>
  cors({
    origin,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

/**
 * CORS middleware configured from `config.CORS_ORIGIN`.
 *
 * Supports a single origin (`http://localhost:3001`) or a comma-separated
 * list (`http://localhost:3001,https://app.example.com`).
 */
export const corsMiddleware = createCorsMiddleware(
  parseOrigins(config.CORS_ORIGIN),
);
