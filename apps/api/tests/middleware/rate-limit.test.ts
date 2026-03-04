import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

import { rateLimiter } from "../../src/middleware/rate-limit.js";
import { errorHandler } from "../../src/middleware/error-handler.js";

// ── Setup ──

const createTestApp = (options = { windowMs: 60_000, max: 3 }): Hono => {
  const app = new Hono();
  app.onError(errorHandler);
  app.use("*", rateLimiter(options));
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
};

describe("rateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", async () => {
    const app = createTestApp();

    const res = await app.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    expect(res.status).toBe(200);
  });

  it("allows exactly max requests in the window", async () => {
    const app = createTestApp({ windowMs: 60_000, max: 3 });

    for (let i = 0; i < 3; i++) {
      const res = await app.request("/test", {
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
      expect(res.status).toBe(200);
    }
  });

  it("rejects requests exceeding the limit with 429", async () => {
    const app = createTestApp({ windowMs: 60_000, max: 2 });

    // Use up the limit
    for (let i = 0; i < 2; i++) {
      await app.request("/test", {
        headers: { "x-forwarded-for": "1.2.3.4" },
      });
    }

    const res = await app.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("includes Retry-After header on 429 response", async () => {
    const app = createTestApp({ windowMs: 60_000, max: 1 });

    await app.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    // Advance 30 seconds
    vi.advanceTimersByTime(30_000);

    const res = await app.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("resets after the window expires", async () => {
    const app = createTestApp({ windowMs: 60_000, max: 1 });

    await app.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    // Advance past the window
    vi.advanceTimersByTime(61_000);

    const res = await app.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    expect(res.status).toBe(200);
  });

  it("tracks clients independently by IP", async () => {
    const app = createTestApp({ windowMs: 60_000, max: 1 });

    await app.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    // Different IP should still be allowed
    const res = await app.request("/test", {
      headers: { "x-forwarded-for": "5.6.7.8" },
    });

    expect(res.status).toBe(200);
  });

  it("uses x-real-ip when x-forwarded-for is absent", async () => {
    const app = createTestApp({ windowMs: 60_000, max: 1 });

    await app.request("/test", {
      headers: { "x-real-ip": "10.0.0.1" },
    });

    const res = await app.request("/test", {
      headers: { "x-real-ip": "10.0.0.1" },
    });

    expect(res.status).toBe(429);
  });

  it("uses first IP from x-forwarded-for chain", async () => {
    const app = createTestApp({ windowMs: 60_000, max: 1 });

    await app.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    });

    const res = await app.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.2" },
    });

    expect(res.status).toBe(429);
  });
});
