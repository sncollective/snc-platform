import { describe, it, expect, vi, afterEach } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";

// ── Mock Services ──

const mockGetActiveRooms = vi.fn();
const mockGetMessageHistory = vi.fn();

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
    }));
    vi.doMock("../../src/middleware/optional-auth.js", () => ({
      optionalAuth: async (c: any, next: any) => {
        c.set("user", null);
        c.set("session", null);
        c.set("roles", []);
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
});
