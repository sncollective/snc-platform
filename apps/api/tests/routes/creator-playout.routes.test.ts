import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

import { makeMockUser, makeMockSession } from "../helpers/auth-fixtures.js";
import { makeTestConfig } from "../helpers/test-constants.js";

// ── Mock Orchestrator Methods ──

const mockGetChannelQueueStatus = vi.fn();
const mockInsertIntoQueue = vi.fn();
const mockRemoveFromQueue = vi.fn();
const mockSkip = vi.fn();
const mockListContent = vi.fn();
const mockAssignContent = vi.fn();
const mockRemoveContent = vi.fn();
const mockSearchAvailableContent = vi.fn();
const mockRequireCreatorPermission = vi.fn();
const mockDbSelect = vi.fn();

// ── Fixtures ──

const CREATOR_CHANNEL_ID = "creator-channel-1";
const CREATOR_ID = "creator-1";
const MEMBER_USER_ID = "user_test123";

const makeCreatorChannel = (overrides: Record<string, unknown> = {}) => ({
  id: CREATOR_CHANNEL_ID,
  ownership: "creator",
  creatorId: CREATOR_ID,
  ...overrides,
});

const makeQueueEntry = () => ({
  id: "entry-1",
  channelId: CREATOR_CHANNEL_ID,
  playoutItemId: "item-1",
  position: 1,
  status: "queued" as const,
  pushedToLiquidsoap: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  title: "Test Film",
  duration: 90.5,
});

const makeQueueStatus = () => ({
  channelId: CREATOR_CHANNEL_ID,
  channelName: "Creator Channel",
  nowPlaying: null,
  upcoming: [makeQueueEntry()],
  poolSize: 3,
});

const makeChannelContent = () => ({
  id: "cc-1",
  channelId: CREATOR_CHANNEL_ID,
  playoutItemId: "item-1",
  contentId: null,
  sourceType: "playout" as const,
  title: "Test Film",
  duration: 90.0,
  lastPlayedAt: null,
  playCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
});

// ── App Builder ──

/**
 * Build a fresh test app for each test. Isolates all module state via vi.doMock.
 * `channelRow` controls what the DB returns when the middleware loads the channel.
 * `permissionThrows` controls whether requireCreatorPermission throws ForbiddenError.
 */
const buildApp = async (options: {
  channelRow?: Record<string, unknown> | null;
  permissionThrows?: boolean;
  userRoles?: string[];
}) => {
  const {
    channelRow = makeCreatorChannel(),
    permissionThrows = false,
    userRoles = [],
  } = options;

  vi.doMock("../../src/config.js", () => ({
    config: makeTestConfig(),
    parseOrigins: (raw: string) => raw.split(",").map((o: string) => o.trim()).filter(Boolean),
  }));

  vi.doMock("../../src/db/connection.js", () => ({
    db: { select: mockDbSelect },
  }));

  vi.doMock("../../src/db/schema/streaming.schema.js", () => ({
    channels: {
      id: "id",
      ownership: "ownership",
      creatorId: "creator_id",
    },
  }));

  vi.doMock("../../src/services/creator-team.js", () => ({
    requireCreatorPermission: mockRequireCreatorPermission,
  }));

  vi.doMock("../../src/routes/playout-channels.init.js", () => ({
    orchestrator: {
      getChannelQueueStatus: mockGetChannelQueueStatus,
      insertIntoQueue: mockInsertIntoQueue,
      removeFromQueue: mockRemoveFromQueue,
      skip: mockSkip,
      listContent: mockListContent,
      assignContent: mockAssignContent,
      removeContent: mockRemoveContent,
      searchAvailableContent: mockSearchAvailableContent,
    },
  }));

  // Wire db.select().from().where() to return channelRow
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(channelRow ? [channelRow] : []),
    }),
  });

  // requireCreatorPermission resolves by default (permission granted)
  if (permissionThrows) {
    const { ForbiddenError } = await import("@snc/shared");
    mockRequireCreatorPermission.mockRejectedValue(
      new ForbiddenError("Insufficient permissions"),
    );
  } else {
    mockRequireCreatorPermission.mockResolvedValue(undefined);
  }

  const { UnauthorizedError, ForbiddenError, NotFoundError } = await import("@snc/shared");

  // Mock requireAuth to inject a user with the given roles
  vi.doMock("../../src/middleware/require-auth.js", () => ({
    requireAuth: async (c: any, next: any) => {
      const user = makeMockUser({ id: MEMBER_USER_ID });
      if (!user) throw new UnauthorizedError();
      c.set("user", user);
      c.set("session", makeMockSession());
      c.set("roles", userRoles);
      await next();
    },
  }));

  const { errorHandler } = await import("../../src/middleware/error-handler.js");
  const { corsMiddleware } = await import("../../src/middleware/cors.js");
  const { creatorPlayoutRoutes } = await import(
    "../../src/routes/creator-playout.routes.js"
  );

  const app = new Hono();
  app.use("*", corsMiddleware);
  app.onError(errorHandler);
  app.route("/api/creator/playout", creatorPlayoutRoutes);
  return app;
};

// ── Shared setup/teardown ──

beforeEach(() => {
  // Reset orchestrator mocks to happy-path defaults
  mockGetChannelQueueStatus.mockResolvedValue({ ok: true, value: makeQueueStatus() });
  mockInsertIntoQueue.mockResolvedValue({ ok: true, value: makeQueueEntry() });
  mockRemoveFromQueue.mockResolvedValue({ ok: true, value: undefined });
  mockSkip.mockResolvedValue({ ok: true, value: undefined });
  mockListContent.mockResolvedValue({ ok: true, value: [makeChannelContent()] });
  mockAssignContent.mockResolvedValue({ ok: true, value: undefined });
  mockRemoveContent.mockResolvedValue({ ok: true, value: undefined });
  mockSearchAvailableContent.mockResolvedValue({ ok: true, value: [] });
});

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── Tests ──

describe("creator playout routes", () => {
  // ── requireCreatorChannelPermission middleware ──

  describe("requireCreatorChannelPermission middleware", () => {
    it("returns 404 when channel does not exist", async () => {
      const app = await buildApp({ channelRow: null });
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/queue`,
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 when channel ownership is 'platform'", async () => {
      const app = await buildApp({
        channelRow: makeCreatorChannel({ ownership: "platform" }),
      });
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/queue`,
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 404 when channel has null creatorId", async () => {
      const app = await buildApp({
        channelRow: makeCreatorChannel({ ownership: "creator", creatorId: null }),
      });
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/queue`,
      );
      expect(res.status).toBe(404);
    });

    it("returns 403 when user lacks manageStreaming permission", async () => {
      const app = await buildApp({ permissionThrows: true });
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/queue`,
      );
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("allows admin role (requireCreatorPermission bypasses on admin)", async () => {
      // Admin permission check is handled inside requireCreatorPermission (which
      // returns without checking membership when "admin" is in roles). Mock returns
      // resolved to simulate that bypass.
      const app = await buildApp({ userRoles: ["admin"] });
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/queue`,
      );
      expect(res.status).toBe(200);
    });

    it("passes channelId and creatorId to requireCreatorPermission", async () => {
      const app = await buildApp({ userRoles: [] });
      await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/queue`,
      );
      expect(mockRequireCreatorPermission).toHaveBeenCalledWith(
        MEMBER_USER_ID,
        CREATOR_ID,
        "manageStreaming",
        [],
      );
    });
  });

  // ── Queue Status ──

  describe("GET /api/creator/playout/channels/:channelId/queue", () => {
    it("returns queue status for authorized creator member", async () => {
      const app = await buildApp({});
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/queue`,
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.channelId).toBe(CREATOR_CHANNEL_ID);
      expect(body.upcoming).toHaveLength(1);
      expect(mockGetChannelQueueStatus).toHaveBeenCalledWith(CREATOR_CHANNEL_ID);
    });

    it("propagates orchestrator error", async () => {
      mockGetChannelQueueStatus.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Channel not found", statusCode: 404 },
      });
      const app = await buildApp({});
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/queue`,
      );
      expect(res.status).toBe(404);
    });
  });

  // ── Insert Queue Item ──

  describe("POST /api/creator/playout/channels/:channelId/queue/items", () => {
    it("inserts item for authorized creator member", async () => {
      const app = await buildApp({});
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/queue/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playoutItemId: "item-1" }),
        },
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBe("entry-1");
      expect(mockInsertIntoQueue).toHaveBeenCalledWith(
        CREATOR_CHANNEL_ID,
        "item-1",
        undefined,
      );
    });

    it("inserts at specific position", async () => {
      const app = await buildApp({});
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/queue/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playoutItemId: "item-1", position: 3 }),
        },
      );
      expect(res.status).toBe(201);
      expect(mockInsertIntoQueue).toHaveBeenCalledWith(
        CREATOR_CHANNEL_ID,
        "item-1",
        3,
      );
    });

    it("returns 400 for invalid body", async () => {
      const app = await buildApp({});
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/queue/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noItemId: true }),
        },
      );
      expect(res.status).toBe(400);
    });

    it("returns 403 when permission denied", async () => {
      const app = await buildApp({ permissionThrows: true });
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/queue/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playoutItemId: "item-1" }),
        },
      );
      expect(res.status).toBe(403);
    });
  });

  // ── Remove Queue Item ──

  describe("DELETE /api/creator/playout/channels/:channelId/queue/items/:entryId", () => {
    it("removes queue entry for authorized creator member", async () => {
      const app = await buildApp({});
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/queue/items/entry-1`,
        { method: "DELETE" },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(mockRemoveFromQueue).toHaveBeenCalledWith(CREATOR_CHANNEL_ID, "entry-1");
    });

    it("returns 409 when trying to remove playing item", async () => {
      mockRemoveFromQueue.mockResolvedValue({
        ok: false,
        error: {
          code: "CANNOT_REMOVE_PLAYING",
          message: "Cannot remove the currently playing item",
          statusCode: 409,
        },
      });
      const app = await buildApp({});
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/queue/items/entry-1`,
        { method: "DELETE" },
      );
      expect(res.status).toBe(409);
    });

    it("returns 404 for non-creator channel", async () => {
      const app = await buildApp({
        channelRow: makeCreatorChannel({ ownership: "platform" }),
      });
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/queue/items/entry-1`,
        { method: "DELETE" },
      );
      expect(res.status).toBe(404);
    });
  });

  // ── Skip ──

  describe("POST /api/creator/playout/channels/:channelId/skip", () => {
    it("skips current track for authorized creator member", async () => {
      const app = await buildApp({});
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/skip`,
        { method: "POST" },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(mockSkip).toHaveBeenCalledWith(CREATOR_CHANNEL_ID);
    });

    it("returns 403 when permission denied", async () => {
      const app = await buildApp({ permissionThrows: true });
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/skip`,
        { method: "POST" },
      );
      expect(res.status).toBe(403);
    });
  });

  // ── Content Pool ──

  describe("GET /api/creator/playout/channels/:channelId/content", () => {
    it("returns content pool items for authorized creator member", async () => {
      const app = await buildApp({});
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/content`,
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0]?.id).toBe("cc-1");
      expect(mockListContent).toHaveBeenCalledWith(CREATOR_CHANNEL_ID);
    });

    it("returns 403 when permission denied", async () => {
      const app = await buildApp({ permissionThrows: true });
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/content`,
      );
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/creator/playout/channels/:channelId/content/search", () => {
    it("returns search results for authorized creator member", async () => {
      mockSearchAvailableContent.mockResolvedValue({
        ok: true,
        value: [{ id: "item-1", sourceType: "playout", title: "Test", duration: 60, creator: null }],
      });
      const app = await buildApp({});
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/content/search?q=test`,
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(mockSearchAvailableContent).toHaveBeenCalledWith(CREATOR_CHANNEL_ID, "test");
    });

    it("uses empty string when q param omitted", async () => {
      const app = await buildApp({});
      await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/content/search`,
      );
      expect(mockSearchAvailableContent).toHaveBeenCalledWith(CREATOR_CHANNEL_ID, "");
    });

    it("returns 404 for non-creator channel", async () => {
      const app = await buildApp({ channelRow: null });
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/content/search?q=test`,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/creator/playout/channels/:channelId/content", () => {
    it("assigns playout items to content pool", async () => {
      const app = await buildApp({});
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/content`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playoutItemIds: ["item-1"] }),
        },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(mockAssignContent).toHaveBeenCalledWith(
        CREATOR_CHANNEL_ID,
        ["item-1"],
        undefined,
      );
    });

    it("returns 403 when permission denied", async () => {
      const app = await buildApp({ permissionThrows: true });
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/content`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playoutItemIds: ["item-1"] }),
        },
      );
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/creator/playout/channels/:channelId/content", () => {
    it("removes playout items from content pool", async () => {
      const app = await buildApp({});
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/content`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playoutItemIds: ["item-1"] }),
        },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(mockRemoveContent).toHaveBeenCalledWith(
        CREATOR_CHANNEL_ID,
        ["item-1"],
        undefined,
      );
    });

    it("returns 403 when permission denied", async () => {
      const app = await buildApp({ permissionThrows: true });
      const res = await app.request(
        `/api/creator/playout/channels/${CREATOR_CHANNEL_ID}/content`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playoutItemIds: ["item-1"] }),
        },
      );
      expect(res.status).toBe(403);
    });
  });
});

// ── SSE content.playout-changed scope filter integration assertion ──

describe("content.playout-changed SSE scope filter", () => {
  it("delivers to a creator member who is in creatorIds", async () => {
    vi.resetModules();
    const { createEventBus } = await import("../../src/services/event-bus.js");
    const bus = createEventBus();

    const receivedEvents: unknown[] = [];
    const sub = bus.subscribe(["content"], {
      userId: "user-1",
      roles: [],
      creatorIds: [CREATOR_ID],
    });

    bus.publish({
      type: "content.playout-changed",
      channelId: CREATOR_CHANNEL_ID,
      creatorId: CREATOR_ID,
      changeType: "queue",
    });

    const events = await sub.next(100);
    sub.close();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "content.playout-changed",
      channelId: CREATOR_CHANNEL_ID,
      creatorId: CREATOR_ID,
    });
  });

  it("does NOT deliver to a user who is not a member of that creator", async () => {
    vi.resetModules();
    const { createEventBus } = await import("../../src/services/event-bus.js");
    const bus = createEventBus();

    const sub = bus.subscribe(["content"], {
      userId: "user-2",
      roles: [],
      // user-2 belongs to a DIFFERENT creator
      creatorIds: ["other-creator-id"],
    });

    bus.publish({
      type: "content.playout-changed",
      channelId: CREATOR_CHANNEL_ID,
      creatorId: CREATOR_ID,
      changeType: "queue",
    });

    const events = await sub.next(100);
    sub.close();

    // Must be empty — the scope filter blocked delivery
    expect(events).toHaveLength(0);
  });

  it("delivers to an admin regardless of creatorIds", async () => {
    vi.resetModules();
    const { createEventBus } = await import("../../src/services/event-bus.js");
    const bus = createEventBus();

    const sub = bus.subscribe(["content"], {
      userId: "admin-user",
      roles: ["admin"],
      creatorIds: [], // admin has no memberships but still receives the event
    });

    bus.publish({
      type: "content.playout-changed",
      channelId: CREATOR_CHANNEL_ID,
      creatorId: CREATOR_ID,
      changeType: "now-playing",
    });

    const events = await sub.next(100);
    sub.close();

    expect(events).toHaveLength(1);
  });

  it("coalesces multiple queue-changed events for the same channel", async () => {
    vi.resetModules();
    const { createEventBus } = await import("../../src/services/event-bus.js");
    const bus = createEventBus();

    const sub = bus.subscribe(["content"], {
      userId: "user-1",
      roles: [],
      creatorIds: [CREATOR_ID],
    });

    // Publish same changeType twice — should coalesce to one
    bus.publish({
      type: "content.playout-changed",
      channelId: CREATOR_CHANNEL_ID,
      creatorId: CREATOR_ID,
      changeType: "queue",
    });
    bus.publish({
      type: "content.playout-changed",
      channelId: CREATOR_CHANNEL_ID,
      creatorId: CREATOR_ID,
      changeType: "queue",
    });

    const events = await sub.next(100);
    sub.close();

    // Coalesced to one event
    expect(events).toHaveLength(1);
  });
});
