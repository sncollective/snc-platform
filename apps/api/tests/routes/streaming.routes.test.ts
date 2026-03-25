import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";

// ── Mock Owncast Service ──

const mockGetStreamStatus = vi.fn();

const ctx = setupRouteTest({
  mockAuth: false,
  mockRole: false,
  defaultAuth: { user: null, session: null, roles: [] },
  mocks: () => {
    vi.doMock("../../src/services/owncast.js", () => ({
      getStreamStatus: mockGetStreamStatus,
    }));
  },
  mountRoute: async (app) => {
    const { streamingRoutes } = await import(
      "../../src/routes/streaming.routes.js"
    );
    app.route("/api/streaming", streamingRoutes);
  },
  beforeEach: () => {
    mockGetStreamStatus.mockResolvedValue({
      ok: true,
      value: {
        online: true,
        viewerCount: 42,
        lastConnectTime: "2026-03-18T10:00:00Z",
        lastDisconnectTime: null,
        hlsUrl: "http://owncast.test:8080/hls/stream.m3u8",
      },
    });
  },
});

describe("streaming routes", () => {
  describe("GET /api/streaming/status", () => {
    it("returns stream status when live", async () => {
      const res = await ctx.app.request("/api/streaming/status");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toStrictEqual({
        isLive: true,
        viewerCount: 42,
        lastLiveAt: "2026-03-18T10:00:00Z",
        hlsUrl: "http://owncast.test:8080/hls/stream.m3u8",
      });
    });

    it("returns offline status with lastDisconnectTime as lastLiveAt", async () => {
      mockGetStreamStatus.mockResolvedValue({
        ok: true,
        value: {
          online: false,
          viewerCount: 0,
          lastConnectTime: "2026-03-18T09:00:00Z",
          lastDisconnectTime: "2026-03-18T10:30:00Z",
          hlsUrl: null,
        },
      });

      const res = await ctx.app.request("/api/streaming/status");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toStrictEqual({
        isLive: false,
        viewerCount: 0,
        lastLiveAt: "2026-03-18T10:30:00Z",
        hlsUrl: null,
      });
    });

    it("returns null lastLiveAt when stream has never been live", async () => {
      mockGetStreamStatus.mockResolvedValue({
        ok: true,
        value: {
          online: false,
          viewerCount: 0,
          lastConnectTime: null,
          lastDisconnectTime: null,
          hlsUrl: null,
        },
      });

      const res = await ctx.app.request("/api/streaming/status");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toStrictEqual({
        isLive: false,
        viewerCount: 0,
        lastLiveAt: null,
        hlsUrl: null,
      });
    });

    it("does not require authentication", async () => {
      const res = await ctx.app.request("/api/streaming/status");
      expect(res.status).toBe(200);
    });

    it("returns 503 when owncast not configured", async () => {
      const { AppError } = await import("@snc/shared");
      mockGetStreamStatus.mockResolvedValue({
        ok: false,
        error: new AppError(
          "STREAMING_NOT_CONFIGURED",
          "Owncast streaming is not configured",
          503,
        ),
      });

      const res = await ctx.app.request("/api/streaming/status");

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error.code).toBe("STREAMING_NOT_CONFIGURED");
    });

    it("returns 502 on owncast upstream error", async () => {
      const { AppError } = await import("@snc/shared");
      mockGetStreamStatus.mockResolvedValue({
        ok: false,
        error: new AppError(
          "OWNCAST_ERROR",
          "Owncast API returned 500",
          502,
        ),
      });

      const res = await ctx.app.request("/api/streaming/status");

      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error.code).toBe("OWNCAST_ERROR");
    });
  });
});
