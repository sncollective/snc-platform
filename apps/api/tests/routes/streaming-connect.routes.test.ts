import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";

// ── Mock Services ──

const mockStartTwitchConnect = vi.fn();
const mockHandleTwitchCallback = vi.fn();
const mockStartYouTubeConnect = vi.fn();
const mockHandleYouTubeCallback = vi.fn();
const mockCreateCreatorSimulcastDestination = vi.fn();
const mockRequireCreatorPermission = vi.fn();

// ── Test Context ──

const ctx = setupRouteTest({
  mockAuth: true,
  mockRole: false,
  mocks: () => {
    vi.doMock("../../src/services/streaming-connect.js", () => ({
      startTwitchConnect: mockStartTwitchConnect,
      handleTwitchCallback: mockHandleTwitchCallback,
      startYouTubeConnect: mockStartYouTubeConnect,
      handleYouTubeCallback: mockHandleYouTubeCallback,
      cleanExpiredStates: vi.fn(),
    }));

    vi.doMock("../../src/services/simulcast.js", () => ({
      createCreatorSimulcastDestination: mockCreateCreatorSimulcastDestination,
    }));

    vi.doMock("../../src/services/creator-team.js", () => ({
      requireCreatorPermission: mockRequireCreatorPermission,
    }));
  },
  mountRoute: async (app) => {
    const { streamingConnectRoutes } = await import(
      "../../src/routes/streaming-connect.routes.js"
    );
    app.route("/api/streaming/connect", streamingConnectRoutes);
  },
  beforeEach: () => {
    mockRequireCreatorPermission.mockResolvedValue(undefined);

    mockStartTwitchConnect.mockReturnValue({
      ok: true,
      value: {
        authorizationUrl: "https://id.twitch.tv/oauth2/authorize?state=abc",
        state: "abc",
      },
    });

    mockHandleTwitchCallback.mockResolvedValue({
      ok: true,
      value: {
        credentials: {
          platform: "twitch",
          rtmpUrl: "rtmp://live.twitch.tv/app",
          streamKey: "live_test_key",
        },
        userId: "user-1",
        creatorId: "creator-1",
      },
    });

    mockStartYouTubeConnect.mockReturnValue({
      ok: true,
      value: {
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=xyz",
        state: "xyz",
      },
    });

    mockHandleYouTubeCallback.mockResolvedValue({
      ok: true,
      value: {
        credentials: {
          platform: "youtube",
          rtmpUrl: "rtmp://a.rtmp.youtube.com/live2",
          streamKey: "yt-stream-key",
        },
        userId: "user-1",
        creatorId: "creator-1",
      },
    });

    mockCreateCreatorSimulcastDestination.mockResolvedValue({ ok: true, value: {} });
  },
});

// ── Tests ──

describe("POST /api/streaming/connect/twitch/start", () => {
  it("returns authorization URL for authenticated owner", async () => {
    const res = await ctx.app.request("/api/streaming/connect/twitch/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId: "creator-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { authorizationUrl: string };
    expect(body.authorizationUrl).toContain("twitch.tv");
    expect(mockStartTwitchConnect).toHaveBeenCalledWith("user_test123", "creator-1");
    expect(mockRequireCreatorPermission).toHaveBeenCalledWith("user_test123", "creator-1", "manageMembers");
  });

  it("returns 401 when not authenticated", async () => {
    ctx.auth.user = null;
    ctx.auth.session = null;

    const res = await ctx.app.request("/api/streaming/connect/twitch/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId: "creator-1" }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks owner permission", async () => {
    const { ForbiddenError } = await import("@snc/shared");
    mockRequireCreatorPermission.mockRejectedValue(new ForbiddenError("Insufficient permissions"));

    const res = await ctx.app.request("/api/streaming/connect/twitch/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId: "creator-1" }),
    });

    expect(res.status).toBe(403);
  });

  it("returns 400 when creatorId is missing", async () => {
    const res = await ctx.app.request("/api/streaming/connect/twitch/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it("propagates service error when Twitch is not configured", async () => {
    const { AppError } = await import("@snc/shared");
    mockStartTwitchConnect.mockReturnValue({
      ok: false,
      error: new AppError("TWITCH_NOT_CONFIGURED", "Twitch is not configured", 503),
    });

    const res = await ctx.app.request("/api/streaming/connect/twitch/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId: "creator-1" }),
    });

    expect(res.status).toBe(503);
  });
});

describe("GET /api/streaming/connect/twitch/callback", () => {
  it("creates simulcast destination and redirects on success", async () => {
    const res = await ctx.app.request(
      "/api/streaming/connect/twitch/callback?code=auth-code&state=valid-state",
    );

    expect(res.status).toBe(302);
    expect(mockHandleTwitchCallback).toHaveBeenCalledWith("auth-code", "valid-state");
    expect(mockCreateCreatorSimulcastDestination).toHaveBeenCalledWith(
      "user-1", // from the handleTwitchCallback mock result
      "creator-1",
      {
        platform: "twitch",
        label: "Twitch",
        rtmpUrl: "rtmp://live.twitch.tv/app",
        streamKey: "live_test_key",
      },
    );

    const location = res.headers.get("location");
    expect(location).toContain("/creators/creator-1/manage/streaming");
  });

  it("redirects to login when state is invalid", async () => {
    const { AppError } = await import("@snc/shared");
    mockHandleTwitchCallback.mockResolvedValue({
      ok: false,
      error: new AppError("TWITCH_INVALID_STATE", "Invalid state", 400),
    });

    const res = await ctx.app.request(
      "/api/streaming/connect/twitch/callback?code=bad-code&state=bad-state",
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toContain("/login?error=TWITCH_INVALID_STATE");
  });

  it("redirects to login when state is expired", async () => {
    const { AppError } = await import("@snc/shared");
    mockHandleTwitchCallback.mockResolvedValue({
      ok: false,
      error: new AppError("TWITCH_STATE_EXPIRED", "State expired", 400),
    });

    const res = await ctx.app.request(
      "/api/streaming/connect/twitch/callback?code=code&state=expired",
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toContain("/login?error=TWITCH_STATE_EXPIRED");
  });

  it("returns 400 when code is missing", async () => {
    const res = await ctx.app.request(
      "/api/streaming/connect/twitch/callback?state=valid-state",
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when state is missing", async () => {
    const res = await ctx.app.request(
      "/api/streaming/connect/twitch/callback?code=auth-code",
    );

    expect(res.status).toBe(400);
  });

  it("still redirects on success even if destination creation fails", async () => {
    mockCreateCreatorSimulcastDestination.mockRejectedValue(new Error("DB error"));

    const res = await ctx.app.request(
      "/api/streaming/connect/twitch/callback?code=auth-code&state=valid-state",
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toContain("/creators/creator-1/manage/streaming");
  });
});

describe("POST /api/streaming/connect/youtube/start", () => {
  it("returns authorization URL for authenticated owner", async () => {
    const res = await ctx.app.request("/api/streaming/connect/youtube/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId: "creator-1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { authorizationUrl: string };
    expect(body.authorizationUrl).toContain("google.com");
    expect(mockStartYouTubeConnect).toHaveBeenCalledWith("user_test123", "creator-1");
  });

  it("returns 401 when not authenticated", async () => {
    ctx.auth.user = null;
    ctx.auth.session = null;

    const res = await ctx.app.request("/api/streaming/connect/youtube/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId: "creator-1" }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 403 when user lacks owner permission", async () => {
    const { ForbiddenError } = await import("@snc/shared");
    mockRequireCreatorPermission.mockRejectedValue(new ForbiddenError("Insufficient permissions"));

    const res = await ctx.app.request("/api/streaming/connect/youtube/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId: "creator-1" }),
    });

    expect(res.status).toBe(403);
  });

  it("propagates service error when YouTube is not configured", async () => {
    const { AppError } = await import("@snc/shared");
    mockStartYouTubeConnect.mockReturnValue({
      ok: false,
      error: new AppError("YOUTUBE_NOT_CONFIGURED", "YouTube is not configured", 503),
    });

    const res = await ctx.app.request("/api/streaming/connect/youtube/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId: "creator-1" }),
    });

    expect(res.status).toBe(503);
  });
});

describe("GET /api/streaming/connect/youtube/callback", () => {
  it("creates simulcast destination and redirects on success", async () => {
    const res = await ctx.app.request(
      "/api/streaming/connect/youtube/callback?code=yt-code&state=valid-state",
    );

    expect(res.status).toBe(302);
    expect(mockHandleYouTubeCallback).toHaveBeenCalledWith("yt-code", "valid-state");
    expect(mockCreateCreatorSimulcastDestination).toHaveBeenCalledWith(
      "user-1",
      "creator-1",
      {
        platform: "youtube",
        label: "YouTube",
        rtmpUrl: "rtmp://a.rtmp.youtube.com/live2",
        streamKey: "yt-stream-key",
      },
    );

    const location = res.headers.get("location");
    expect(location).toContain("/creators/creator-1/manage/streaming");
  });

  it("redirects to login when state is invalid", async () => {
    const { AppError } = await import("@snc/shared");
    mockHandleYouTubeCallback.mockResolvedValue({
      ok: false,
      error: new AppError("YOUTUBE_INVALID_STATE", "Invalid state", 400),
    });

    const res = await ctx.app.request(
      "/api/streaming/connect/youtube/callback?code=bad-code&state=bad-state",
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toContain("/login?error=YOUTUBE_INVALID_STATE");
  });

  it("returns 400 when code is missing", async () => {
    const res = await ctx.app.request(
      "/api/streaming/connect/youtube/callback?state=valid-state",
    );

    expect(res.status).toBe(400);
  });
});
