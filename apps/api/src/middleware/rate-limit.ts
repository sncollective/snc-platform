import type { MiddlewareHandler } from "hono";

import { RateLimitError } from "@snc/shared";

import { getClientIp } from "../lib/request-helpers.js";

// ── Public Types ──

export type RateLimitOptions = {
  readonly windowMs: number;
  readonly max: number;
};

// ── Private State ──

type ClientRecord = {
  count: number;
  resetAt: number;
};

// ── Public API ──

/** Create an in-memory per-IP rate limiter with sliding window cleanup. */
export const rateLimiter = (options: RateLimitOptions): MiddlewareHandler => {
  const { windowMs, max } = options;
  const clients = new Map<string, ClientRecord>();

  // Periodic cleanup of expired entries (every 60s)
  const CLEANUP_INTERVAL = 60_000;
  let lastCleanup = Date.now();

  const cleanup = () => {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;
    for (const [key, record] of clients) {
      if (now >= record.resetAt) {
        clients.delete(key);
      }
    }
  };

  return async (c, next) => {
    cleanup();

    const ip = getClientIp(c) ?? "unknown";

    const now = Date.now();
    const existing = clients.get(ip);

    if (!existing || now >= existing.resetAt) {
      clients.set(ip, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    existing.count++;

    if (existing.count > max) {
      const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      throw new RateLimitError();
    }

    await next();
  };
};
