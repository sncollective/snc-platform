import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import {
  TEST_CONFIG,
  makeTestConfig,
} from "../helpers/test-constants.js";

// ── Mock SRS Service ──

const mockGetStreamStatus = vi.fn();

const ctx = setupRouteTest({
  mockAuth: false,
  mockRole: false,
  defaultAuth: { user: null, session: null, roles: [] },
  mocks: () => {
    vi.doMock("../../src/services/srs.js", () => ({
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
        isLive: true,
        viewerCount: 42,
        hlsUrl: "http://srs.test:8080/live/livestream.m3u8",
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
        lastLiveAt: null,
        hlsUrl: "http://srs.test:8080/live/livestream.m3u8",
      });
    });

    it("returns offline status with null lastLiveAt", async () => {
      mockGetStreamStatus.mockResolvedValue({
        ok: true,
        value: {
          isLive: false,
          viewerCount: 0,
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

    it("returns 503 when SRS not configured", async () => {
      const { AppError } = await import("@snc/shared");
      mockGetStreamStatus.mockResolvedValue({
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
      mockGetStreamStatus.mockResolvedValue({
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
  });

  describe("POST /api/streaming/callbacks/on-publish", () => {
    const validBody = {
      action: "on_publish" as const,
      client_id: "abc123",
      ip: "127.0.0.1",
      vhost: "__defaultVhost__",
      app: "live",
      stream: "livestream",
      param: "?key=test-stream-key",
    };

    it("allows publish with valid key", async () => {
      const res = await ctx.app.request(
        "/api/streaming/callbacks/on-publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toStrictEqual({ code: 0 });
    });

    it("rejects publish with invalid key", async () => {
      const res = await ctx.app.request(
        "/api/streaming/callbacks/on-publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...validBody, param: "?key=wrong" }),
        },
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toStrictEqual({ code: 1 });
    });

    it("rejects publish with missing key", async () => {
      const res = await ctx.app.request(
        "/api/streaming/callbacks/on-publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...validBody, param: "" }),
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

    describe("when no stream key is configured", () => {
      let noKeyApp: Hono;

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
          getStreamStatus: mockGetStreamStatus,
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

        noKeyApp = new Hono();
        noKeyApp.use("*", corsMiddleware);
        noKeyApp.onError(errorHandler);
        noKeyApp.route("/api/streaming", streamingRoutes);
      });

      afterEach(() => {
        vi.resetModules();
      });

      it("allows all publishes when no stream key configured", async () => {
        const res = await noKeyApp.request(
          "/api/streaming/callbacks/on-publish",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "on_publish",
              client_id: "abc123",
              ip: "127.0.0.1",
              vhost: "__defaultVhost__",
              app: "live",
              stream: "livestream",
              param: "",
            }),
          },
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toStrictEqual({ code: 0 });
      });
    });
  });
});
