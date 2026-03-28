import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import {
  TEST_CONFIG,
  makeTestConfig,
} from "../helpers/test-constants.js";

// ── Mock Services ──

const mockGetChannelList = vi.fn();
const mockLookupCreatorByKeyHash = vi.fn();
const mockOpenSession = vi.fn();
const mockCloseSession = vi.fn();
const mockListStreamKeys = vi.fn();
const mockCreateStreamKey = vi.fn();
const mockRevokeStreamKey = vi.fn();
const mockCreateLiveChannel = vi.fn();
const mockDeactivateLiveChannel = vi.fn();
const mockCreateChannelRoom = vi.fn();
const mockCloseChannelRoom = vi.fn();
const mockBroadcastToRoom = vi.fn();

// ── Fixtures ──

const makeChannel = (overrides?: Partial<{
  id: string;
  name: string;
  type: "playout" | "live" | "scheduled";
  thumbnailUrl: string | null;
  hlsUrl: string | null;
  viewerCount: number;
  creator: null;
  startedAt: string | null;
  nowPlaying: null;
}>) => ({
  id: "channel-1",
  name: "S/NC Radio",
  type: "playout" as const,
  thumbnailUrl: null,
  hlsUrl: "http://srs.test:8080/live/channel-main.m3u8",
  viewerCount: 0,
  creator: null,
  startedAt: null,
  nowPlaying: null,
  ...overrides,
});

const ctx = setupRouteTest({
  mockAuth: true,
  mockRole: false,
  mocks: () => {
    vi.doMock("../../src/services/srs.js", () => ({
      getChannelList: mockGetChannelList,
    }));
    vi.doMock("../../src/services/stream-keys.js", () => ({
      lookupCreatorByKeyHash: mockLookupCreatorByKeyHash,
      listStreamKeys: mockListStreamKeys,
      createStreamKey: mockCreateStreamKey,
      revokeStreamKey: mockRevokeStreamKey,
    }));
    vi.doMock("../../src/services/stream-sessions.js", () => ({
      openSession: mockOpenSession,
      closeSession: mockCloseSession,
    }));
    vi.doMock("../../src/services/channels.js", () => ({
      createLiveChannel: mockCreateLiveChannel,
      deactivateLiveChannel: mockDeactivateLiveChannel,
    }));
    vi.doMock("../../src/services/chat.js", () => ({
      createChannelRoom: mockCreateChannelRoom,
      closeChannelRoom: mockCloseChannelRoom,
    }));
    vi.doMock("../../src/services/chat-rooms.js", () => ({
      broadcastToRoom: mockBroadcastToRoom,
    }));
    vi.doMock("../../src/db/connection.js", () => ({
      db: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      },
      sql: vi.fn(),
    }));
    vi.doMock("../../src/db/schema/streaming.schema.js", () => ({
      streamSessions: { srsClientId: "srsClientId", endedAt: "endedAt", id: "id" },
      channels: {},
    }));
    vi.doMock("../../src/db/schema/creator.schema.js", () => ({
      creatorProfiles: { id: "id", displayName: "displayName" },
    }));
  },
  mountRoute: async (app) => {
    const { streamingRoutes } = await import(
      "../../src/routes/streaming.routes.js"
    );
    app.route("/api/streaming", streamingRoutes);
  },
  beforeEach: () => {
    mockGetChannelList.mockResolvedValue({
      ok: true,
      value: {
        channels: [makeChannel()],
        defaultChannelId: "channel-1",
      },
    });
    mockOpenSession.mockResolvedValue({ ok: true, value: { sessionId: "session-1" } });
    mockCloseSession.mockResolvedValue({ ok: true, value: undefined });
    mockLookupCreatorByKeyHash.mockResolvedValue(null);
    mockCreateLiveChannel.mockResolvedValue({ ok: true, value: { channelId: "channel-1" } });
    mockDeactivateLiveChannel.mockResolvedValue({ ok: true, value: null });
    mockCreateChannelRoom.mockResolvedValue({ id: "room-1", type: "channel", channelId: "channel-1", name: "Test", createdAt: "2026-03-01T00:00:00.000Z", closedAt: null });
    mockCloseChannelRoom.mockResolvedValue(undefined);
    mockBroadcastToRoom.mockReturnValue(undefined);
  },
});

describe("streaming routes", () => {
  describe("GET /api/streaming/status", () => {
    it("returns channel list", async () => {
      const res = await ctx.app.request("/api/streaming/status");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.channels).toHaveLength(1);
      expect(body.channels[0]?.id).toBe("channel-1");
      expect(body.channels[0]?.name).toBe("S/NC Radio");
      expect(body.defaultChannelId).toBe("channel-1");
    });

    it("returns empty channels list when no active channels", async () => {
      mockGetChannelList.mockResolvedValue({
        ok: true,
        value: {
          channels: [],
          defaultChannelId: null,
        },
      });

      const res = await ctx.app.request("/api/streaming/status");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.channels).toStrictEqual([]);
      expect(body.defaultChannelId).toBeNull();
    });

    it("does not require authentication", async () => {
      const res = await ctx.app.request("/api/streaming/status");
      expect(res.status).toBe(200);
    });

    it("returns 503 when SRS not configured", async () => {
      const { AppError } = await import("@snc/shared");
      mockGetChannelList.mockResolvedValue({
        ok: false,
        error: new AppError(
          "STREAMING_NOT_CONFIGURED",
          "SRS streaming is not configured",
          503,
        ),
      });

      const res = await ctx.app.request("/api/streaming/status");

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error.code).toBe("STREAMING_NOT_CONFIGURED");
    });

    it("returns 502 on SRS upstream error", async () => {
      const { AppError } = await import("@snc/shared");
      mockGetChannelList.mockResolvedValue({
        ok: false,
        error: new AppError(
          "SRS_ERROR",
          "SRS API returned 500",
          502,
        ),
      });

      const res = await ctx.app.request("/api/streaming/status");

      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error.code).toBe("SRS_ERROR");
    });

    it("includes creator info in channel response for live channels", async () => {
      const liveChannel = makeChannel({
        id: "channel-2",
        name: "Live: Maya",
        type: "live",
        creator: {
          id: "creator-1",
          displayName: "Maya",
          handle: "maya",
          avatarUrl: null,
        } as never,
        viewerCount: 42,
      });
      mockGetChannelList.mockResolvedValue({
        ok: true,
        value: {
          channels: [liveChannel],
          defaultChannelId: "channel-2",
        },
      });

      const res = await ctx.app.request("/api/streaming/status");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.channels[0]?.creator?.displayName).toBe("Maya");
      expect(body.channels[0]?.viewerCount).toBe(42);
    });
  });

  describe("POST /api/streaming/callbacks/on-publish (playout key)", () => {
    const playoutBody = {
      action: "on_publish" as const,
      client_id: "liquidsoap-123",
      ip: "127.0.0.1",
      vhost: "__defaultVhost__",
      app: "live",
      stream: "channel-main",
      param: "?key=pk_test_playout_key",
    };

    it("allows publish with valid playout key", async () => {
      const res = await ctx.app.request(
        "/api/streaming/callbacks/on-publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(playoutBody),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toStrictEqual({ code: 0 });
    });

    it("rejects publish with wrong playout key", async () => {
      const res = await ctx.app.request(
        "/api/streaming/callbacks/on-publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...playoutBody, param: "?key=wrong" }),
        },
      );

      // Wrong key goes to per-creator lookup which returns null → 403
      expect(res.status).toBe(403);
    });

    it("rejects publish with missing key", async () => {
      const res = await ctx.app.request(
        "/api/streaming/callbacks/on-publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...playoutBody, param: "" }),
        },
      );

      expect(res.status).toBe(403);
    });

    it("returns 400 on invalid body", async () => {
      const res = await ctx.app.request(
        "/api/streaming/callbacks/on-publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "wrong" }),
        },
      );

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/streaming/callbacks/on-publish (per-creator keys)", () => {
    let perCreatorApp: Hono;

    beforeEach(async () => {
      vi.resetModules();

      vi.doMock("../../src/config.js", () => ({
        config: makeTestConfig({ SRS_STREAM_KEY: undefined }),
        parseOrigins: (raw: string) =>
          raw
            .split(",")
            .map((o: string) => o.trim())
            .filter(Boolean),
      }));

      vi.doMock("../../src/services/srs.js", () => ({
        getChannelList: mockGetChannelList,
      }));
      vi.doMock("../../src/services/stream-keys.js", () => ({
        lookupCreatorByKeyHash: mockLookupCreatorByKeyHash,
        listStreamKeys: mockListStreamKeys,
        createStreamKey: mockCreateStreamKey,
        revokeStreamKey: mockRevokeStreamKey,
      }));
      vi.doMock("../../src/services/stream-sessions.js", () => ({
        openSession: mockOpenSession,
        closeSession: mockCloseSession,
      }));
      vi.doMock("../../src/services/channels.js", () => ({
        createLiveChannel: mockCreateLiveChannel,
        deactivateLiveChannel: mockDeactivateLiveChannel,
      }));
      vi.doMock("../../src/services/chat.js", () => ({
        createChannelRoom: mockCreateChannelRoom,
        closeChannelRoom: mockCloseChannelRoom,
      }));
      vi.doMock("../../src/services/chat-rooms.js", () => ({
        broadcastToRoom: mockBroadcastToRoom,
      }));
      vi.doMock("../../src/db/connection.js", () => ({
        db: {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        },
        sql: vi.fn(),
      }));
      vi.doMock("../../src/db/schema/streaming.schema.js", () => ({
        streamSessions: { srsClientId: "srsClientId", endedAt: "endedAt", id: "id" },
        channels: {},
      }));
      vi.doMock("../../src/db/schema/creator.schema.js", () => ({
        creatorProfiles: { id: "id", displayName: "displayName" },
      }));
      vi.doMock("../../src/middleware/require-auth.js", () => ({
        requireAuth: async (_c: unknown, next: () => Promise<void>) => next(),
      }));

      const { errorHandler } = await import(
        "../../src/middleware/error-handler.js"
      );
      const { corsMiddleware } = await import(
        "../../src/middleware/cors.js"
      );
      const { streamingRoutes } = await import(
        "../../src/routes/streaming.routes.js"
      );

      perCreatorApp = new Hono();
      perCreatorApp.use("*", corsMiddleware);
      perCreatorApp.onError(errorHandler);
      perCreatorApp.route("/api/streaming", streamingRoutes);
    });

    afterEach(() => {
      vi.resetModules();
    });

    const baseBody = {
      action: "on_publish" as const,
      client_id: "abc123",
      ip: "127.0.0.1",
      vhost: "__defaultVhost__",
      app: "live",
      stream: "livestream",
    };

    it("allows publish with valid per-creator key", async () => {
      mockLookupCreatorByKeyHash.mockResolvedValue({
        creatorId: "creator-1",
        keyId: "key-1",
      });
      mockOpenSession.mockResolvedValue({ ok: true, value: { sessionId: "session-1" } });
      mockCreateLiveChannel.mockResolvedValue({ ok: true, value: { channelId: "channel-1" } });

      const res = await perCreatorApp.request(
        "/api/streaming/callbacks/on-publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, param: "?key=sk_validkey123" }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toStrictEqual({ code: 0 });
      expect(mockOpenSession).toHaveBeenCalledTimes(1);
    });

    it("rejects publish with unknown key (hash not found)", async () => {
      mockLookupCreatorByKeyHash.mockResolvedValue(null);

      const res = await perCreatorApp.request(
        "/api/streaming/callbacks/on-publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, param: "?key=sk_unknownkey" }),
        },
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toStrictEqual({ code: 1 });
    });

    it("rejects publish with no key", async () => {
      const res = await perCreatorApp.request(
        "/api/streaming/callbacks/on-publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, param: "" }),
        },
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toStrictEqual({ code: 1 });
    });

    it("allows all publishes when SRS_STREAM_KEY not configured and no per-creator key needed", async () => {
      // When no SRS_STREAM_KEY set AND no key provided → rejects (per-creator mode requires key)
      const res = await perCreatorApp.request(
        "/api/streaming/callbacks/on-publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...baseBody, param: "" }),
        },
      );

      // Per-creator mode: no key = 403
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/streaming/callbacks/on-unpublish", () => {
    const validBody = {
      action: "on_unpublish" as const,
      client_id: "abc123",
      ip: "127.0.0.1",
      vhost: "__defaultVhost__",
      app: "live",
      stream: "livestream",
      param: "",
    };

    it("closes session on valid unpublish", async () => {
      mockCloseSession.mockResolvedValue({ ok: true, value: undefined });

      const res = await ctx.app.request(
        "/api/streaming/callbacks/on-unpublish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toStrictEqual({ code: 0 });
      expect(mockCloseSession).toHaveBeenCalledWith(
        expect.objectContaining({ srsClientId: "abc123" }),
      );
    });

    it("returns 200 even without matching session", async () => {
      mockCloseSession.mockResolvedValue({ ok: true, value: undefined });

      const res = await ctx.app.request(
        "/api/streaming/callbacks/on-unpublish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...validBody, client_id: "unknown-client" }),
        },
      );

      expect(res.status).toBe(200);
    });

    it("returns 400 on invalid body", async () => {
      const res = await ctx.app.request(
        "/api/streaming/callbacks/on-unpublish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "wrong_action" }),
        },
      );

      expect(res.status).toBe(400);
    });

    it("deactivates channel and closes chat room when channel found", async () => {
      mockCloseSession.mockResolvedValue({ ok: true, value: undefined });
      mockDeactivateLiveChannel.mockResolvedValue({
        ok: true,
        value: { channelId: "channel-1" },
      });

      const res = await ctx.app.request(
        "/api/streaming/callbacks/on-unpublish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
      );

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/streaming/keys/:creatorId", () => {
    it("requires auth", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request("/api/streaming/keys/creator-1");
      expect(res.status).toBe(401);
    });

    it("returns keys for owner", async () => {
      mockListStreamKeys.mockResolvedValue({
        ok: true,
        value: [
          {
            id: "key-1",
            name: "My Key",
            keyPrefix: "sk_a1b2c3d4e",
            createdAt: "2026-03-01T00:00:00.000Z",
            revokedAt: null,
          },
        ],
      });

      const res = await ctx.app.request("/api/streaming/keys/creator-1");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.keys).toHaveLength(1);
      expect(body.keys[0]?.name).toBe("My Key");
    });
  });

  describe("POST /api/streaming/keys/:creatorId", () => {
    it("requires auth", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request("/api/streaming/keys/creator-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Key" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns raw key on creation", async () => {
      mockCreateStreamKey.mockResolvedValue({
        ok: true,
        value: {
          id: "key-1",
          name: "Test Key",
          keyPrefix: "sk_a1b2c3d4e",
          createdAt: "2026-03-01T00:00:00.000Z",
          revokedAt: null,
          rawKey: "sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
        },
      });

      const res = await ctx.app.request("/api/streaming/keys/creator-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test Key" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.rawKey).toBeDefined();
      expect(body.rawKey).toMatch(/^sk_/);
    });
  });

  describe("DELETE /api/streaming/keys/:creatorId/:keyId", () => {
    it("requires auth", async () => {
      ctx.auth.user = null;
      ctx.auth.session = null;

      const res = await ctx.app.request(
        "/api/streaming/keys/creator-1/key-1",
        { method: "DELETE" },
      );
      expect(res.status).toBe(401);
    });

    it("returns updated key with revokedAt set", async () => {
      mockRevokeStreamKey.mockResolvedValue({
        ok: true,
        value: {
          id: "key-1",
          name: "My Key",
          keyPrefix: "sk_a1b2c3d4e",
          createdAt: "2026-03-01T00:00:00.000Z",
          revokedAt: "2026-03-26T10:00:00.000Z",
        },
      });

      const res = await ctx.app.request(
        "/api/streaming/keys/creator-1/key-1",
        { method: "DELETE" },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.revokedAt).not.toBeNull();
    });
  });
});
