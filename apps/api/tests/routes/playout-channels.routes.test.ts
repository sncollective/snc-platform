import { describe, it, expect, vi, afterEach } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";

// ── Mock Orchestrator Methods ──

const mockGetChannelQueueStatus = vi.fn();
const mockOnTrackStarted = vi.fn();
const mockInsertIntoQueue = vi.fn();
const mockRemoveFromQueue = vi.fn();
const mockSkip = vi.fn();
const mockListContent = vi.fn();
const mockAssignContent = vi.fn();
const mockRemoveContent = vi.fn();
const mockSearchAvailableContent = vi.fn();

// ── Fixtures ──

/** Must match the value in test-constants.ts TEST_CONFIG.PLAYOUT_CALLBACK_SECRET */
const VALID_SECRET = "test-playout-callback-secret-minimum-32-chars";

const makeQueueEntry = (overrides: Record<string, unknown> = {}) => ({
  id: "entry-1",
  channelId: "channel-1",
  playoutItemId: "item-1",
  position: 1,
  status: "queued" as const,
  pushedToLiquidsoap: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  title: "Test Film",
  duration: 90.5,
  ...overrides,
});

const makeQueueStatus = () => ({
  channelId: "channel-1",
  channelName: "S/NC Classics",
  nowPlaying: null,
  upcoming: [makeQueueEntry()],
  poolSize: 5,
});

const makeChannelContent = () => ({
  id: "cc-1",
  channelId: "channel-1",
  playoutItemId: "item-1",
  contentId: null,
  sourceType: "playout" as const,
  title: "Test Film",
  duration: 90.0,
  lastPlayedAt: null,
  playCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const makePoolCandidate = (overrides: Record<string, unknown> = {}) => ({
  id: "item-1",
  sourceType: "playout" as const,
  title: "Test Film",
  duration: 90.0,
  creator: null,
  ...overrides,
});

// ── Route Test Context ──

const ctx = setupRouteTest({
  mockAuth: true,
  mockRole: true,
  defaultAuth: {
    roles: ["admin"],
  },
  mocks: () => {
    vi.doMock("../../src/routes/playout-channels.init.js", () => ({
      orchestrator: {
        getChannelQueueStatus: mockGetChannelQueueStatus,
        onTrackStarted: mockOnTrackStarted,
        insertIntoQueue: mockInsertIntoQueue,
        removeFromQueue: mockRemoveFromQueue,
        skip: mockSkip,
        listContent: mockListContent,
        assignContent: mockAssignContent,
        removeContent: mockRemoveContent,
        searchAvailableContent: mockSearchAvailableContent,
      },
    }));
  },
  mountRoute: async (app) => {
    const { playoutChannelRoutes } = await import(
      "../../src/routes/playout-channels.routes.js"
    );
    app.route("/api/playout", playoutChannelRoutes);
  },
  beforeEach: () => {
    mockGetChannelQueueStatus.mockResolvedValue({
      ok: true,
      value: makeQueueStatus(),
    });
    mockOnTrackStarted.mockResolvedValue({ ok: true, value: undefined });
    mockInsertIntoQueue.mockResolvedValue({
      ok: true,
      value: makeQueueEntry(),
    });
    mockRemoveFromQueue.mockResolvedValue({ ok: true, value: undefined });
    mockSkip.mockResolvedValue({ ok: true, value: undefined });
    mockListContent.mockResolvedValue({
      ok: true,
      value: [makeChannelContent()],
    });
    mockAssignContent.mockResolvedValue({ ok: true, value: undefined });
    mockRemoveContent.mockResolvedValue({ ok: true, value: undefined });
    mockSearchAvailableContent.mockResolvedValue({
      ok: true,
      value: [makePoolCandidate()],
    });
  },
});

// ── Tests ──

describe("playout channel routes", () => {
  // ── Track Event ──

  describe("POST /api/playout/channels/:channelId/track-event", () => {
    it("accepts event with valid secret", async () => {
      const res = await ctx.app.request(
        `/api/playout/channels/channel-1/track-event?secret=${VALID_SECRET}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uri: "s3://snc-storage/playout/item-1/1080p.mp4" }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(mockOnTrackStarted).toHaveBeenCalledWith(
        "channel-1",
        "s3://snc-storage/playout/item-1/1080p.mp4",
      );
    });

    it("rejects missing secret with 401", async () => {
      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/track-event",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uri: "s3://snc-storage/playout/item-1/1080p.mp4" }),
        },
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects wrong secret with 401", async () => {
      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/track-event?secret=wrong-secret",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uri: "s3://snc-storage/playout/item-1/1080p.mp4" }),
        },
      );

      expect(res.status).toBe(401);
    });

    it("returns 400 when body is missing required uri field", async () => {
      const res = await ctx.app.request(
        `/api/playout/channels/channel-1/track-event?secret=${VALID_SECRET}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "no uri here" }),
        },
      );

      expect(res.status).toBe(400);
    });

    it("propagates orchestrator error", async () => {
      mockOnTrackStarted.mockResolvedValue({
        ok: false,
        error: { code: "NOT_FOUND", message: "Channel not found", statusCode: 404 },
      });

      const res = await ctx.app.request(
        `/api/playout/channels/channel-1/track-event?secret=${VALID_SECRET}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uri: "s3://snc-storage/playout/item-1/1080p.mp4" }),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  // ── Queue Status ──

  describe("GET /api/playout/channels/:channelId/queue", () => {
    it("returns queue status for admin", async () => {
      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/queue",
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.channelId).toBe("channel-1");
      expect(body.channelName).toBe("S/NC Classics");
      expect(body.upcoming).toHaveLength(1);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/queue",
      );
      expect(res.status).toBe(401);
    });

    it("returns 403 when not admin", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/queue",
      );
      expect(res.status).toBe(403);
    });
  });

  // ── Insert Queue Item ──

  describe("POST /api/playout/channels/:channelId/queue/items", () => {
    it("inserts item at end of queue", async () => {
      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/queue/items",
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
        "channel-1",
        "item-1",
        undefined,
      );
    });

    it("inserts at specific position when provided", async () => {
      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/queue/items",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playoutItemId: "item-1", position: 2 }),
        },
      );

      expect(res.status).toBe(201);
      expect(mockInsertIntoQueue).toHaveBeenCalledWith(
        "channel-1",
        "item-1",
        2,
      );
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/queue/items",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playoutItemId: "item-1" }),
        },
      );
      expect(res.status).toBe(401);
    });

    it("returns 403 when not admin", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/queue/items",
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

  describe("DELETE /api/playout/channels/:channelId/queue/items/:entryId", () => {
    it("removes queue entry", async () => {
      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/queue/items/entry-1",
        { method: "DELETE" },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(mockRemoveFromQueue).toHaveBeenCalledWith("channel-1", "entry-1");
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

      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/queue/items/entry-1",
        { method: "DELETE" },
      );

      expect(res.status).toBe(409);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/queue/items/entry-1",
        { method: "DELETE" },
      );
      expect(res.status).toBe(401);
    });
  });

  // ── Skip ──

  describe("POST /api/playout/channels/:channelId/skip", () => {
    it("skips current track", async () => {
      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/skip",
        { method: "POST" },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(mockSkip).toHaveBeenCalledWith("channel-1");
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/skip",
        { method: "POST" },
      );
      expect(res.status).toBe(401);
    });
  });

  // ── Content Pool ──

  describe("GET /api/playout/channels/:channelId/content", () => {
    it("returns content pool items for admin", async () => {
      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/content",
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0]?.id).toBe("cc-1");
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/content",
      );
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/playout/channels/:channelId/content", () => {
    it("assigns playout items to content pool", async () => {
      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/content",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playoutItemIds: ["item-1", "item-2"] }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(mockAssignContent).toHaveBeenCalledWith(
        "channel-1",
        ["item-1", "item-2"],
        undefined,
      );
    });

    it("assigns creator content to pool", async () => {
      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/content",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentIds: ["content-1"] }),
        },
      );

      expect(res.status).toBe(200);
      expect(mockAssignContent).toHaveBeenCalledWith(
        "channel-1",
        [],
        ["content-1"],
      );
    });

    it("returns 400 when neither playoutItemIds nor contentIds are provided", async () => {
      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/content",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playoutItemIds: [] }),
        },
      );

      expect(res.status).toBe(400);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/content",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playoutItemIds: ["item-1"] }),
        },
      );
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/playout/channels/:channelId/content", () => {
    it("removes playout items from content pool", async () => {
      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/content",
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
        "channel-1",
        ["item-1"],
        undefined,
      );
    });

    it("removes creator content from pool", async () => {
      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/content",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentIds: ["content-1"] }),
        },
      );

      expect(res.status).toBe(200);
      expect(mockRemoveContent).toHaveBeenCalledWith(
        "channel-1",
        [],
        ["content-1"],
      );
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/content",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playoutItemIds: ["item-1"] }),
        },
      );
      expect(res.status).toBe(401);
    });
  });

  // ── Content Search ──

  describe("GET /api/playout/channels/:channelId/content/search", () => {
    it("returns search results for admin", async () => {
      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/content/search?q=test",
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.items[0]?.id).toBe("item-1");
      expect(mockSearchAvailableContent).toHaveBeenCalledWith("channel-1", "test");
    });

    it("uses empty string when q param is omitted", async () => {
      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/content/search",
      );

      expect(res.status).toBe(200);
      expect(mockSearchAvailableContent).toHaveBeenCalledWith("channel-1", "");
    });

    it("returns mixed playout and creator content results", async () => {
      mockSearchAvailableContent.mockResolvedValue({
        ok: true,
        value: [
          makePoolCandidate({ id: "item-1", sourceType: "playout", creator: null }),
          makePoolCandidate({ id: "content-1", sourceType: "content", title: "Creator Video", creator: "Jane Doe" }),
        ],
      });

      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/content/search?q=video",
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(2);
      expect(body.items[0]?.sourceType).toBe("playout");
      expect(body.items[1]?.sourceType).toBe("content");
      expect(body.items[1]?.creator).toBe("Jane Doe");
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/content/search?q=test",
      );
      expect(res.status).toBe(401);
    });

    it("returns 403 when not admin", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request(
        "/api/playout/channels/channel-1/content/search?q=test",
      );
      expect(res.status).toBe(403);
    });
  });
});
