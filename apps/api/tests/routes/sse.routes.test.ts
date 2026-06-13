import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

import type { EventBus } from "../../src/services/event-bus.js";
import { makeMockUser, makeMockSession } from "../helpers/auth-fixtures.js";
import { makeTestConfig } from "../helpers/test-constants.js";

// ── Shared Mock Factories ──

/**
 * Build a mock Subscription that returns pre-scheduled event batches.
 * batches: array of event arrays to return in sequence; after exhausted returns []
 * after heartbeatMs delay (simulating a quiet interval).
 */
const makeMockSub = (
  batches: unknown[][] = [],
  opts: { closeAfterNexts?: number } = {},
) => {
  let callCount = 0;
  let closed = false;
  return {
    next: vi.fn(async (_timeoutMs: number): Promise<unknown[]> => {
      callCount++;
      if (opts.closeAfterNexts !== undefined && callCount >= opts.closeAfterNexts) {
        closed = true;
      }
      if (callCount <= batches.length) {
        return batches[callCount - 1]!;
      }
      // Post-close, the real subscription resolves [] immediately
      if (closed) return [];
      // No more batches — block until timeout to simulate quiet interval
      return new Promise((resolve) => setTimeout(() => resolve([]), _timeoutMs));
    }),
    close: vi.fn(() => {
      closed = true;
    }),
    isClosed: vi.fn(() => closed),
  };
};

/** Build a mock EventBus with a controllable subscription. */
const makeMockBus = (sub: ReturnType<typeof makeMockSub>, connectionCount = 0): EventBus => ({
  publish: vi.fn(),
  // Use vi.fn(impl) rather than vi.fn().mockReturnValue() — mockReturnValue is reset by
  // vi.resetAllMocks() in afterEach, which can corrupt async stream callbacks still in flight.
  subscribe: vi.fn((_topics: unknown, _ctx: unknown) => sub as any),
  closeAll: vi.fn(),
  connectionCount: vi.fn(() => connectionCount),
});

/** Read full SSE body; waits for stream to close (required since lifetimeMs is short in tests). */
const readSseFrames = async (res: Response): Promise<string> => res.text();

// ── Test App Builder ──

interface TestSetup {
  user?: ReturnType<typeof makeMockUser> | null;
  session?: ReturnType<typeof makeMockSession> | null;
  roles?: string[];
  sub?: ReturnType<typeof makeMockSub>;
  connectionCount?: number;
}

/**
 * Build an isolated Hono test app for SSE routes.
 * Must call vi.resetModules() before this; each call registers fresh doMocks.
 */
const buildTestApp = async (setup: TestSetup = {}) => {
  const user = "user" in setup ? setup.user : makeMockUser();
  const session = "session" in setup ? setup.session : makeMockSession();
  const roles = setup.roles ?? [];
  const mockSub = setup.sub ?? makeMockSub();
  const mockBus = makeMockBus(mockSub, setup.connectionCount ?? 0);

  vi.doMock("../../src/config.js", () => ({
    config: makeTestConfig(),
    parseOrigins: (raw: string) =>
      raw.split(",").map((o: string) => o.trim()).filter(Boolean),
  }));

  vi.doMock("../../src/services/event-bus.js", () => ({
    createEventBus: vi.fn().mockReturnValue(mockBus),
    eventBus: mockBus,
  }));

  // Mock DB for creator membership lookup (content topic scope filter).
  // Default: user is a member of "creator-1".
  vi.doMock("../../src/db/connection.js", () => ({
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ creatorId: "creator-1" }]),
        }),
      }),
    },
  }));

  vi.doMock("../../src/db/schema/creator.schema.js", () => ({
    creatorMembers: { userId: {}, creatorId: {} },
  }));

  vi.doMock("../../src/middleware/optional-auth.js", () => ({
    optionalAuth: async (c: any, next: any) => {
      c.set("user", user);
      c.set("session", session);
      c.set("roles", roles);
      await next();
    },
  }));

  vi.doMock("../../src/middleware/rate-limit.js", () => ({
    rateLimiter: () => async (_c: any, next: any) => next(),
  }));

  const { errorHandler } = await import("../../src/middleware/error-handler.js");
  const { corsMiddleware } = await import("../../src/middleware/cors.js");
  const { createSseRoutes } = await import("../../src/routes/sse.routes.js");

  const routes = createSseRoutes({
    bus: mockBus,
    heartbeatMs: 30,
    lifetimeMs: 200,
    maxConnections: 2,
  });

  const app = new Hono();
  app.use("*", corsMiddleware);
  app.onError(errorHandler);
  app.route("/api/sse", routes);

  return { app, mockBus, mockSub };
};

// ── Tests ──

describe("SSE routes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // 1. Anon + live → granted
  it("anon with ?topics=live receives spine.connected with granted:[live]", async () => {
    const { app } = await buildTestApp({ user: null, session: null, roles: [] });

    const res = await app.request("/api/sse?topics=live");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const body = await readSseFrames(res);
    expect(body).toContain("event: spine.connected");
    expect(body).toContain('"granted":["live"]');
    expect(body).toContain('"denied":[]');
  });

  // 2. Anon + live,playout → live granted, playout denied
  it("anon with ?topics=live,playout receives denied:[playout]", async () => {
    const { app } = await buildTestApp({ user: null, session: null, roles: [] });

    const res = await app.request("/api/sse?topics=live,playout");
    const body = await readSseFrames(res);
    expect(body).toContain('"granted":["live"]');
    expect(body).toContain('"denied":["playout"]');
  });

  // 3. Admin session + playout → granted
  it("admin with ?topics=playout receives granted:[playout]", async () => {
    const { app } = await buildTestApp({ roles: ["admin"] });

    const res = await app.request("/api/sse?topics=playout");
    const body = await readSseFrames(res);
    expect(body).toContain('"granted":["playout"]');
    expect(body).toContain('"denied":[]');
  });

  // 4. Typo in topic → 400
  it("unknown topic name ?topics=playuot → 400", async () => {
    const { app } = await buildTestApp();

    const res = await app.request("/api/sse?topics=playuot");
    expect(res.status).toBe(400);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  // 5. Missing topics → 400 (validator rejects empty/missing string)
  it("missing ?topics → 400", async () => {
    const { app } = await buildTestApp();

    const res = await app.request("/api/sse");
    expect(res.status).toBe(400);
  });

  // 6. Published event reaches the stream
  // Note: use null session to avoid the session-expiry deadline bound (mock session has
  // expiresAt in 2025 which is already past, causing the deadline to be in the past).
  it("bus event published reaches stream as event: channel.live-state-changed", async () => {
    const liveEvent = {
      type: "channel.live-state-changed",
      channelId: "ch-1",
      live: true,
    };
    const sub = makeMockSub([[liveEvent]]);
    const { app } = await buildTestApp({ sub, user: null, session: null, roles: [] });

    const res = await app.request("/api/sse?topics=live");
    const body = await readSseFrames(res);
    expect(body).toContain("event: channel.live-state-changed");
    expect(body).toContain('"channelId":"ch-1"');
  });

  // 7. Heartbeat on quiet turn
  // Note: use null session to avoid the session-expiry deadline bound (mock session has
  // expiresAt in 2025 which is already past, causing the deadline to be in the past).
  it("sends heartbeat comment on empty next() turn", async () => {
    // sub with empty batches: each next() blocks for heartbeatMs=30ms then returns []
    const sub = makeMockSub([]);
    const { app } = await buildTestApp({ sub, user: null, session: null, roles: [] });

    const res = await app.request("/api/sse?topics=live");
    const body = await readSseFrames(res);
    // heartbeat comment in SSE format
    expect(body).toContain(": heartbeat");
  });

  // 8. Connection cap → 503
  it("returns 503 when connection cap is reached", async () => {
    // DI: maxConnections=2, connectionCount=2 → already at cap
    const { app } = await buildTestApp({ connectionCount: 2 });

    const res = await app.request("/api/sse?topics=live");
    expect(res.status).toBe(503);
    const json = await res.json() as { error: { code: string } };
    expect(json.error.code).toBe("SSE_CAPACITY");
  });

  // 9. Content-Type and Cache-Control headers
  // Note: Hono's streamSSE always sets Cache-Control: no-cache (the standard SSE value).
  // c.header("Cache-Control", ...) before streamSSE is overwritten by streamSSE.
  it("sets correct Content-Type header on SSE response", async () => {
    const { app } = await buildTestApp();

    const res = await app.request("/api/sse?topics=live");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });

  // 10. Sub.close() is called on stream end
  it("calls sub.close() when stream lifecycle ends", async () => {
    const sub = makeMockSub([]);
    const { app } = await buildTestApp({ sub });

    const res = await app.request("/api/sse?topics=live");
    await readSseFrames(res);

    expect(sub.close).toHaveBeenCalled();
  });

  // 10b. Loop ends on subscription close — the busy-spin / shutdown regression.
  // Post-close, next() resolves [] immediately; without the isClosed() break the
  // loop would treat every turn as a heartbeat and spin until the deadline.
  it("ends the stream when the subscription closes, without further heartbeats", async () => {
    const sub = makeMockSub([], { closeAfterNexts: 1 });
    const { app } = await buildTestApp({ user: null, session: null, roles: [], sub });

    const res = await app.request("/api/sse?topics=live");
    const body = await readSseFrames(res);

    expect(body).toContain("event: spine.connected");
    expect(body).not.toContain(": heartbeat");
    expect(sub.close).toHaveBeenCalled();
  });

  // 11. Authenticated user + content topic → granted
  it("authenticated user with ?topics=content receives granted:[content]", async () => {
    const { app } = await buildTestApp({
      user: makeMockUser(),
      session: makeMockSession(),
      roles: [],
    });

    const res = await app.request("/api/sse?topics=content");
    const body = await readSseFrames(res);
    expect(body).toContain('"granted":["content"]');
    expect(body).toContain('"denied":[]');
  });

  // 12. Unauthenticated + content → denied
  it("anon with ?topics=content receives denied:[content]", async () => {
    const { app } = await buildTestApp({ user: null, session: null, roles: [] });

    const res = await app.request("/api/sse?topics=content");
    const body = await readSseFrames(res);
    expect(body).toContain('"granted":[]');
    expect(body).toContain('"denied":["content"]');
  });

  // 13. Duplicate topics deduped — only granted once
  it("deduplicates repeated topic names in CSV", async () => {
    const { app } = await buildTestApp({ user: null, session: null, roles: [] });

    const res = await app.request("/api/sse?topics=live,live,live");
    const body = await readSseFrames(res);
    // granted should contain live exactly once
    expect(body).toContain('"granted":["live"]');
  });
});
