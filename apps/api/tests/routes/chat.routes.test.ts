import { describe, it, expect, vi, afterEach } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";

// ── Mock Services ──

const mockGetActiveRooms = vi.fn();
const mockGetMessageHistory = vi.fn();
const mockGetModerationHistory = vi.fn();
const mockGetActiveSanctions = vi.fn();
const mockGetWordFilters = vi.fn();
const mockAddWordFilter = vi.fn();
const mockRemoveWordFilter = vi.fn();
const mockGetReactionsForMessage = vi.fn();

const ctx = setupRouteTest({
  mockAuth: true,
  mockRole: false,
  mocks: () => {
    // Mock ws.ts to avoid importing @hono/node-ws (which requires real HTTP server)
    vi.doMock("../../src/ws.js", () => ({
      upgradeWebSocket: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
      },
      injectWebSocket: vi.fn(),
    }));
    vi.doMock("../../src/services/chat.js", () => ({
      getActiveRooms: mockGetActiveRooms,
      getMessageHistory: mockGetMessageHistory,
      createMessage: vi.fn(),
      ensurePlatformRoom: vi.fn(),
      createStreamRoom: vi.fn(),
      closeStreamRoom: vi.fn(),
    }));
    vi.doMock("../../src/services/chat-rooms.js", () => ({
      joinRoom: vi.fn(),
      leaveRoom: vi.fn(),
      leaveAllRooms: vi.fn(),
      broadcastToRoom: vi.fn(),
      getRoomClientCount: vi.fn(),
      getRoomPresence: vi.fn().mockReturnValue({ viewerCount: 0, users: [] }),
      registerClient: vi.fn(),
      unregisterClient: vi.fn(),
    }));
    vi.doMock("../../src/services/chat-moderation.js", () => ({
      timeoutUser: vi.fn(),
      banUser: vi.fn(),
      unbanUser: vi.fn(),
      setSlowMode: vi.fn(),
      getModerationHistory: mockGetModerationHistory,
      getActiveSanctions: mockGetActiveSanctions,
    }));
    vi.doMock("../../src/services/chat-word-filters.js", () => ({
      addWordFilter: mockAddWordFilter,
      removeWordFilter: mockRemoveWordFilter,
      getWordFilters: mockGetWordFilters,
    }));
    vi.doMock("../../src/services/chat-reactions.js", () => ({
      addReaction: vi.fn(),
      removeReaction: vi.fn(),
      getReactionsForMessage: mockGetReactionsForMessage,
      getReactionsBatch: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    }));
    vi.doMock("../../src/middleware/optional-auth.js", () => ({
      optionalAuth: async (c: any, next: any) => {
        // Use the ctx.auth state so individual tests can set a user
        c.set("user", ctx.auth.user);
        c.set("session", ctx.auth.session);
        c.set("roles", ctx.auth.roles);
        await next();
      },
    }));
  },
  mountRoute: async (app) => {
    const { chatRoutes } = await import("../../src/routes/chat.routes.js");
    app.route("/api/chat", chatRoutes);
  },
  beforeEach: () => {
    mockGetActiveRooms.mockResolvedValue([]);
    mockGetMessageHistory.mockResolvedValue({
      ok: true,
      value: { messages: [], hasMore: false },
    });
    mockGetModerationHistory.mockResolvedValue({
      ok: true,
      value: { actions: [], hasMore: false },
    });
    mockGetActiveSanctions.mockResolvedValue({
      ok: true,
      value: [],
    });
    mockGetWordFilters.mockResolvedValue({
      ok: true,
      value: [],
    });
    mockAddWordFilter.mockResolvedValue({
      ok: true,
      value: {
        id: "filter-1",
        roomId: "room-1",
        pattern: "badword",
        isRegex: false,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    });
    mockRemoveWordFilter.mockResolvedValue({
      ok: true,
      value: undefined,
    });
    mockGetReactionsForMessage.mockResolvedValue({
      ok: true,
      value: [],
    });
  },
});

// ── Fixtures ──

const makeRoom = (overrides?: Partial<{
  id: string;
  type: string;
  streamSessionId: string | null;
  name: string;
  createdAt: string;
  closedAt: string | null;
}>) => ({
  id: "room-1",
  type: "platform",
  streamSessionId: null,
  name: "Community",
  createdAt: "2026-03-01T10:00:00.000Z",
  closedAt: null,
  ...overrides,
});

const makeMessage = (overrides?: Partial<{
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  content: string;
  createdAt: string;
}>) => ({
  id: "msg-1",
  roomId: "room-1",
  userId: "user-1",
  userName: "Alice",
  avatarUrl: null,
  content: "Hello world",
  createdAt: "2026-03-01T10:05:00.000Z",
  ...overrides,
});

// ── Tests ──

describe("chat routes", () => {
  describe("GET /api/chat/rooms", () => {
    it("returns empty rooms array when no rooms active", async () => {
      mockGetActiveRooms.mockResolvedValue([]);

      const res = await ctx.app.request("/api/chat/rooms");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toStrictEqual({ rooms: [] });
    });

    it("returns active rooms list", async () => {
      const room = makeRoom();
      mockGetActiveRooms.mockResolvedValue([room]);

      const res = await ctx.app.request("/api/chat/rooms");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.rooms).toHaveLength(1);
      expect(body.rooms[0]).toMatchObject({
        id: "room-1",
        type: "platform",
        name: "Community",
      });
    });

    it("does not require authentication", async () => {
      const res = await ctx.app.request("/api/chat/rooms");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/chat/rooms/:roomId/messages", () => {
    it("returns message history for a room", async () => {
      const message = makeMessage();
      mockGetMessageHistory.mockResolvedValue({
        ok: true,
        value: { messages: [message], hasMore: false },
      });

      const res = await ctx.app.request("/api/chat/rooms/room-1/messages");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0]).toMatchObject({ content: "Hello world" });
      expect(body.hasMore).toBe(false);
    });

    it("accepts a before cursor parameter", async () => {
      mockGetMessageHistory.mockResolvedValue({
        ok: true,
        value: { messages: [], hasMore: false },
      });

      const res = await ctx.app.request(
        "/api/chat/rooms/room-1/messages?before=2026-03-01T10:00:00.000Z",
      );

      expect(res.status).toBe(200);
      expect(mockGetMessageHistory).toHaveBeenCalledWith(
        expect.objectContaining({ before: "2026-03-01T10:00:00.000Z" }),
      );
    });

    it("accepts a limit parameter", async () => {
      mockGetMessageHistory.mockResolvedValue({
        ok: true,
        value: { messages: [], hasMore: false },
      });

      const res = await ctx.app.request(
        "/api/chat/rooms/room-1/messages?limit=10",
      );

      expect(res.status).toBe(200);
      expect(mockGetMessageHistory).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 }),
      );
    });

    it("returns hasMore true when more messages exist", async () => {
      mockGetMessageHistory.mockResolvedValue({
        ok: true,
        value: { messages: [makeMessage()], hasMore: true },
      });

      const res = await ctx.app.request("/api/chat/rooms/room-1/messages");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.hasMore).toBe(true);
    });
  });

  describe("GET /api/chat/rooms/:roomId/moderation", () => {
    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      // Rebuild app with null user
      const res = await ctx.app.request("/api/chat/rooms/room-1/moderation");
      expect(res.status).toBe(401);
    });

    it("returns moderation history when authenticated", async () => {
      // ctx.auth.user is set by beforeEach to makeMockUser()
      const res = await ctx.app.request("/api/chat/rooms/room-1/moderation");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.actions).toBeDefined();
    });
  });

  describe("GET /api/chat/rooms/:roomId/filters", () => {
    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      const res = await ctx.app.request("/api/chat/rooms/room-1/filters");
      expect(res.status).toBe(401);
    });

    it("returns word filters when authenticated", async () => {
      const res = await ctx.app.request("/api/chat/rooms/room-1/filters");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.filters).toBeDefined();
    });
  });

  describe("POST /api/chat/rooms/:roomId/filters", () => {
    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;
      const res = await ctx.app.request("/api/chat/rooms/room-1/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern: "bad", isRegex: false }),
      });
      expect(res.status).toBe(401);
    });

    it("creates word filter when authenticated", async () => {
      const res = await ctx.app.request("/api/chat/rooms/room-1/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern: "badword", isRegex: false }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.pattern).toBe("badword");
    });
  });

  describe("GET /api/chat/rooms/:roomId/messages/:messageId/reactions", () => {
    it("returns reactions array when authenticated", async () => {
      const reactions = [
        { emoji: "👍", count: 2, reactedByMe: true },
      ];
      mockGetReactionsForMessage.mockResolvedValue({ ok: true, value: reactions });

      const res = await ctx.app.request("/api/chat/rooms/room-1/messages/msg-1/reactions");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reactions).toEqual(reactions);
    });

    it("works unauthenticated (read-only)", async () => {
      ctx.auth.user = null;
      mockGetReactionsForMessage.mockResolvedValue({ ok: true, value: [] });

      const res = await ctx.app.request("/api/chat/rooms/room-1/messages/msg-1/reactions");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reactions).toEqual([]);
    });
  });
});
