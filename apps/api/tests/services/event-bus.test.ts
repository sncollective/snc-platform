import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Setup ──

const setupService = async () => {
  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }));
  return await import("../../src/services/event-bus.js");
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── Helpers ──

const liveEvent = (channelId = "ch-1") =>
  ({
    type: "channel.live-state-changed" as const,
    channelId,
    live: true,
  }) as const;

const guestCtx = { userId: null, roles: [] };
const adminCtx = { userId: "admin-1", roles: ["admin"] };

// ── Grant filtering ──

describe("grant filtering", () => {
  it("delivers channel.live-state-changed to a live-topic subscriber", async () => {
    const { createEventBus } = await setupService();
    const bus = createEventBus();
    const sub = bus.subscribe(["live"], guestCtx);

    bus.publish(liveEvent());
    const batch = await sub.next(100);

    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({ type: "channel.live-state-changed", channelId: "ch-1" });
    sub.close();
  });

  it("does NOT deliver channel.live-state-changed to a playout-only subscriber", async () => {
    const { createEventBus } = await setupService();
    const bus = createEventBus();
    const sub = bus.subscribe(["playout"], adminCtx);

    bus.publish(liveEvent());
    const batch = await sub.next(50);

    expect(batch).toHaveLength(0);
    sub.close();
  });

  it("delivers to a subscriber with multiple topics including the matching one", async () => {
    const { createEventBus } = await setupService();
    const bus = createEventBus();
    const sub = bus.subscribe(["live", "playout"], guestCtx);

    bus.publish(liveEvent());
    const batch = await sub.next(100);

    expect(batch).toHaveLength(1);
    sub.close();
  });
});

// ── Coalescing ──

describe("coalescing", () => {
  it("collapses 3 events for the same channelId into 1 delivered event", async () => {
    const { createEventBus } = await setupService();
    const bus = createEventBus();
    const sub = bus.subscribe(["live"], guestCtx);

    bus.publish({ type: "channel.live-state-changed", channelId: "ch-1", live: false });
    bus.publish({ type: "channel.live-state-changed", channelId: "ch-1", live: true });
    bus.publish({ type: "channel.live-state-changed", channelId: "ch-1", live: false });

    const batch = await sub.next(100);
    expect(batch).toHaveLength(1);
    // Last event wins
    expect(batch[0]).toMatchObject({ live: false });
    sub.close();
  });

  it("keeps separate events for different channelIds distinct", async () => {
    const { createEventBus } = await setupService();
    const bus = createEventBus();
    const sub = bus.subscribe(["live"], guestCtx);

    bus.publish(liveEvent("ch-1"));
    bus.publish(liveEvent("ch-2"));
    bus.publish(liveEvent("ch-1")); // overwrite ch-1

    const batch = await sub.next(100);
    expect(batch).toHaveLength(2);
    const channelIds = batch.map((e) => (e as { channelId: string }).channelId).sort();
    expect(channelIds).toEqual(["ch-1", "ch-2"]);
    sub.close();
  });
});

// ── next() timeout ──

describe("next(timeoutMs)", () => {
  it("resolves with [] after timeout when no events are published", async () => {
    const { createEventBus } = await setupService();
    const bus = createEventBus();
    const sub = bus.subscribe(["live"], guestCtx);

    const start = Date.now();
    const batch = await sub.next(50);
    const elapsed = Date.now() - start;

    expect(batch).toHaveLength(0);
    expect(elapsed).toBeGreaterThanOrEqual(40); // allow small timer variance
    sub.close();
  });

  it("resolves promptly when an event is published before timeout", async () => {
    const { createEventBus } = await setupService();
    const bus = createEventBus();
    const sub = bus.subscribe(["live"], guestCtx);

    // Schedule publish after a brief delay
    setTimeout(() => bus.publish(liveEvent()), 10);

    const start = Date.now();
    const batch = await sub.next(5_000);
    const elapsed = Date.now() - start;

    expect(batch).toHaveLength(1);
    expect(elapsed).toBeLessThan(200); // should not wait 5s
    sub.close();
  });

  it("drains queued events immediately on next() call", async () => {
    const { createEventBus } = await setupService();
    const bus = createEventBus();
    const sub = bus.subscribe(["live"], guestCtx);

    // Pre-enqueue before calling next()
    bus.publish(liveEvent());

    const batch = await sub.next(5_000);
    expect(batch).toHaveLength(1);
    sub.close();
  });
});

// ── closeAll ──

describe("closeAll()", () => {
  it("resolves a pending next() call with [] on closeAll", async () => {
    const { createEventBus } = await setupService();
    const bus = createEventBus();
    const sub = bus.subscribe(["live"], guestCtx);

    const nextPromise = sub.next(30_000);
    // Close all after a brief delay
    setTimeout(() => bus.closeAll(), 10);

    const batch = await nextPromise;
    expect(batch).toHaveLength(0);
  });

  it("closes every subscription (isClosed flips, count drops, next resolves immediately)", async () => {
    const { createEventBus } = await setupService();
    const bus = createEventBus();
    const s1 = bus.subscribe(["live"], guestCtx);
    const s2 = bus.subscribe(["live"], guestCtx);
    expect(s1.isClosed()).toBe(false);

    bus.closeAll();

    expect(s1.isClosed()).toBe(true);
    expect(s2.isClosed()).toBe(true);
    expect(bus.connectionCount()).toBe(0);
    // Post-close next() must resolve immediately — a 30s timeout here would hang the test
    const batch = await s1.next(30_000);
    expect(batch).toHaveLength(0);
  });

  it("makes subsequent publish a no-op after closeAll", async () => {
    const { createEventBus } = await setupService();
    const bus = createEventBus();
    const sub = bus.subscribe(["live"], guestCtx);

    bus.closeAll();
    // Should not throw and the subscription should not receive events
    expect(() => bus.publish(liveEvent())).not.toThrow();

    const batch = await sub.next(50);
    expect(batch).toHaveLength(0);
  });
});

// ── connectionCount ──

describe("connectionCount()", () => {
  it("tracks open subscriptions", async () => {
    const { createEventBus } = await setupService();
    const bus = createEventBus();

    expect(bus.connectionCount()).toBe(0);
    const s1 = bus.subscribe(["live"], guestCtx);
    expect(bus.connectionCount()).toBe(1);
    const s2 = bus.subscribe(["live"], guestCtx);
    expect(bus.connectionCount()).toBe(2);

    s1.close();
    expect(bus.connectionCount()).toBe(1);
    s2.close();
    expect(bus.connectionCount()).toBe(0);
  });
});

// ── Multiple subscribers ──

describe("multiple subscribers", () => {
  it("delivers events to all matching subscribers independently", async () => {
    const { createEventBus } = await setupService();
    const bus = createEventBus();

    const sub1 = bus.subscribe(["live"], guestCtx);
    const sub2 = bus.subscribe(["live"], guestCtx);
    const sub3 = bus.subscribe(["playout"], adminCtx);

    bus.publish(liveEvent());

    const [b1, b2, b3] = await Promise.all([
      sub1.next(100),
      sub2.next(100),
      sub3.next(50),
    ]);

    expect(b1).toHaveLength(1);
    expect(b2).toHaveLength(1);
    expect(b3).toHaveLength(0);

    sub1.close();
    sub2.close();
    sub3.close();
  });
});

// ── scopeFilter structural coverage ──

describe("scopeFilter (structural)", () => {
  it("excludes subscriber when scopeFilter returns false", async () => {
    const { createEventBus, EVENT_REGISTRY } = await setupService();

    // Temporarily add a scopeFilter to the live event (non-destructive to module state
    // since each setupService() call gets a fresh module via resetModules).
    const originalEntry = EVENT_REGISTRY["channel.live-state-changed"];
    EVENT_REGISTRY["channel.live-state-changed"] = {
      ...originalEntry,
      scopeFilter: (_event, ctx) => ctx.userId !== null, // require authenticated
    };

    const bus = createEventBus();
    const guestSub = bus.subscribe(["live"], guestCtx);
    const authedSub = bus.subscribe(["live"], { userId: "user-1", roles: [] });

    bus.publish(liveEvent());

    const [guestBatch, authedBatch] = await Promise.all([
      guestSub.next(100),
      authedSub.next(100),
    ]);

    expect(guestBatch).toHaveLength(0);
    expect(authedBatch).toHaveLength(1);

    guestSub.close();
    authedSub.close();

    // Restore
    EVENT_REGISTRY["channel.live-state-changed"] = originalEntry;
  });
});
