import type { MiddlewareHandler } from "hono";

import { RateLimitError } from "@snc/shared";

import type { Config } from "../config.js";
import { getClientIp } from "../lib/request-helpers.js";

// ── Public Types ──

export type RateLimitOptions = {
  readonly windowMs: number;
  readonly max: number;
};

// ── Public Constants ──

export const STRICT_AUTH_RATE_LIMIT_MAX = 10;
export const E2E_AUTH_RATE_LIMIT_MAX = 1_000;
export const SRS_CALLBACK_RATE_LIMIT_MAX = 30;
export const E2E_SRS_CALLBACK_RATE_LIMIT_MAX = 1_000;

// ── Private State ──

type ClientRecord = {
  count: number;
  resetAt: number;
};

// ── Public API ──

/** Resolve the strict auth endpoint limiter cap for the configured runtime profile. */
export const getAuthStrictRateLimitMax = (
  cfg: Pick<Config, "AUTH_RATE_LIMIT_PROFILE">,
): number => {
  if (cfg.AUTH_RATE_LIMIT_PROFILE === "e2e") {
    return E2E_AUTH_RATE_LIMIT_MAX;
  }
  return STRICT_AUTH_RATE_LIMIT_MAX;
};

/** Resolve the SRS callback limiter cap for the configured runtime profile. */
export const getSrsCallbackRateLimitMax = (
  cfg: Pick<Config, "TEST_CONTROL_PROFILE">,
): number => {
  if (cfg.TEST_CONTROL_PROFILE === "e2e") {
    return E2E_SRS_CALLBACK_RATE_LIMIT_MAX;
  }
  return SRS_CALLBACK_RATE_LIMIT_MAX;
};

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
