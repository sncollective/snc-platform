import { describe, it, expect, vi, beforeEach } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { TEST_CONFIG } from "../helpers/test-constants.js";

// ── Mock State ──

const mockStartMastodonAuth = vi.fn();
const mockHandleMastodonCallback = vi.fn();

// ── Test Context ──

const ctx = setupRouteTest({
  mockAuth: false,
  mockRole: false,
  mocks: () => {
    vi.doMock("../../src/services/mastodon-auth.js", () => ({
      startMastodonAuth: mockStartMastodonAuth,
      handleMastodonCallback: mockHandleMastodonCallback,
    }));
  },
  mountRoute: async (app) => {
    const { mastodonAuthRoutes } = await import(
      "../../src/routes/mastodon-auth.routes.js"
    );
    app.route("/api/auth/mastodon", mastodonAuthRoutes);
  },
  beforeEach: () => {
    mockStartMastodonAuth.mockResolvedValue({
      ok: true,
      value: {
        authorizationUrl: "https://mastodon.social/oauth/authorize?client_id=test&state=abc",
        state: "abc",
      },
    });

    mockHandleMastodonCallback.mockResolvedValue({
      ok: true,
      value: {
        userId: "user-1",
        sessionToken: "test-session-token",
        sessionId: "session-1",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  },
});

// ── Tests ──

describe("Mastodon auth routes", () => {
  describe("POST /api/auth/mastodon/start", () => {
    it("returns authorization URL for valid instance domain", async () => {
      const res = await ctx.app.request("/api/auth/mastodon/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceDomain: "mastodon.social" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { authorizationUrl: string };
      expect(body.authorizationUrl).toContain("mastodon.social");
      expect(mockStartMastodonAuth).toHaveBeenCalledWith("mastodon.social");
    });

    it("returns 400 for missing instanceDomain", async () => {
      const res = await ctx.app.request("/api/auth/mastodon/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for empty instanceDomain", async () => {
      const res = await ctx.app.request("/api/auth/mastodon/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceDomain: "" }),
      });

      expect(res.status).toBe(400);
    });

    it("propagates service errors", async () => {
      const { AppError } = await import("@snc/shared");
      mockStartMastodonAuth.mockResolvedValue({
        ok: false,
        error: new AppError("MASTODON_UNREACHABLE", "Cannot reach instance", 502),
      });

      const res = await ctx.app.request("/api/auth/mastodon/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceDomain: "offline.example" }),
      });

      expect(res.status).toBe(502);
    });
  });

  describe("GET /api/auth/mastodon/callback", () => {
    it("sets session cookie and redirects on success", async () => {
      const res = await ctx.app.request(
        "/api/auth/mastodon/callback?code=auth-code&state=csrf-state",
      );

      expect(res.status).toBe(302);
      expect(mockHandleMastodonCallback).toHaveBeenCalledWith("auth-code", "csrf-state");

      const location = res.headers.get("location");
      expect(location).toBeTruthy();

      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toContain("better-auth.session_token=");
      expect(setCookie).toContain("HttpOnly");
    });

    it("returns 400 for missing code", async () => {
      const res = await ctx.app.request(
        "/api/auth/mastodon/callback?state=csrf-state",
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 for missing state", async () => {
      const res = await ctx.app.request(
        "/api/auth/mastodon/callback?code=auth-code",
      );

      expect(res.status).toBe(400);
    });

    it("propagates service errors", async () => {
      const { AppError } = await import("@snc/shared");
      mockHandleMastodonCallback.mockResolvedValue({
        ok: false,
        error: new AppError("MASTODON_INVALID_STATE", "Invalid state", 400),
      });

      const res = await ctx.app.request(
        "/api/auth/mastodon/callback?code=bad-code&state=bad-state",
      );

      expect(res.status).toBe(400);
    });
  });
});
