import { describe, it, expect, vi, afterEach } from "vitest";

// ── Setup Factory ──

const setupService = async (configOverrides?: Record<string, unknown>) => {
  vi.doMock("../../src/config.js", () => ({
    config: {
      BETTER_AUTH_URL: "http://localhost:3080",
      TWITCH_CLIENT_ID: "twitch-client-id",
      TWITCH_CLIENT_SECRET: "twitch-client-secret",
      YOUTUBE_CLIENT_ID: "youtube-client-id",
      YOUTUBE_CLIENT_SECRET: "youtube-client-secret",
      ...configOverrides,
    },
  }));

  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: {
      child: vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      }),
    },
  }));

  return await import("../../src/services/streaming-connect.js");
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── Twitch ──

describe("startTwitchConnect", () => {
  it("returns authorization URL with correct scopes", async () => {
    const { startTwitchConnect } = await setupService();

    const result = startTwitchConnect("user-1", "creator-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.authorizationUrl).toContain("https://id.twitch.tv/oauth2/authorize");
    expect(result.value.authorizationUrl).toContain("channel%3Aread%3Astream_key");
    expect(result.value.authorizationUrl).toContain("client_id=twitch-client-id");
    expect(result.value.state).toBeTruthy();
    expect(result.value.state).toHaveLength(64); // 32 bytes = 64 hex chars
  });

  it("returns error when TWITCH_CLIENT_ID is not configured", async () => {
    const { startTwitchConnect } = await setupService({
      TWITCH_CLIENT_ID: undefined,
    });

    const result = startTwitchConnect("user-1", "creator-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("TWITCH_NOT_CONFIGURED");
    expect(result.error.statusCode).toBe(503);
  });

  it("generates unique state tokens per call", async () => {
    const { startTwitchConnect } = await setupService();

    const r1 = startTwitchConnect("user-1", "creator-1");
    const r2 = startTwitchConnect("user-1", "creator-1");

    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.value.state).not.toBe(r2.value.state);
  });
});

describe("handleTwitchCallback", () => {
  it("exchanges code for token, fetches user and stream key, returns credentials", async () => {
    const { startTwitchConnect, handleTwitchCallback } = await setupService();

    // Generate a valid state
    const startResult = startTwitchConnect("user-1", "creator-1");
    expect(startResult.ok).toBe(true);
    if (!startResult.ok) return;

    // Mock fetch responses in order: token, user, stream key
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "twitch-access-token" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ id: "broadcaster-123" }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ stream_key: "live_abc123" }] }),
        }),
    );

    const result = await handleTwitchCallback("auth-code", startResult.value.state);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.credentials.platform).toBe("twitch");
    expect(result.value.credentials.rtmpUrl).toBe("rtmp://live.twitch.tv/app");
    expect(result.value.credentials.streamKey).toBe("live_abc123");
    expect(result.value.userId).toBe("user-1");
    expect(result.value.creatorId).toBe("creator-1");

    vi.unstubAllGlobals();
  });

  it("returns error for invalid state", async () => {
    const { handleTwitchCallback } = await setupService();

    const result = await handleTwitchCallback("code", "invalid-state");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("TWITCH_INVALID_STATE");
    expect(result.error.statusCode).toBe(400);
  });

  it("returns error for expired state", async () => {
    const { startTwitchConnect, handleTwitchCallback } = await setupService();

    const startResult = startTwitchConnect("user-1", "creator-1");
    expect(startResult.ok).toBe(true);
    if (!startResult.ok) return;

    // Advance time past TTL
    vi.useFakeTimers();
    vi.advanceTimersByTime(11 * 60 * 1000);

    const result = await handleTwitchCallback("code", startResult.value.state);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("TWITCH_STATE_EXPIRED");

    vi.useRealTimers();
  });

  it("returns error when state was issued for wrong platform", async () => {
    const { startYouTubeConnect, handleTwitchCallback } = await setupService();

    // Generate a YouTube state but try to use it in Twitch callback
    const startResult = startYouTubeConnect("user-1", "creator-1");
    expect(startResult.ok).toBe(true);
    if (!startResult.ok) return;

    const result = await handleTwitchCallback("code", startResult.value.state);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("TWITCH_WRONG_PLATFORM");
  });

  it("returns error when token exchange fails", async () => {
    const { startTwitchConnect, handleTwitchCallback } = await setupService();

    const startResult = startTwitchConnect("user-1", "creator-1");
    expect(startResult.ok).toBe(true);
    if (!startResult.ok) return;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 400 }));

    const result = await handleTwitchCallback("bad-code", startResult.value.state);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("TWITCH_TOKEN_FAILED");

    vi.unstubAllGlobals();
  });
});

// ── YouTube ──

describe("startYouTubeConnect", () => {
  it("returns authorization URL with correct scope", async () => {
    const { startYouTubeConnect } = await setupService();

    const result = startYouTubeConnect("user-1", "creator-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.authorizationUrl).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(result.value.authorizationUrl).toContain("youtube.force-ssl");
    expect(result.value.authorizationUrl).toContain("client_id=youtube-client-id");
    expect(result.value.state).toBeTruthy();
  });

  it("returns error when YOUTUBE_CLIENT_ID is not configured", async () => {
    const { startYouTubeConnect } = await setupService({
      YOUTUBE_CLIENT_ID: undefined,
    });

    const result = startYouTubeConnect("user-1", "creator-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("YOUTUBE_NOT_CONFIGURED");
    expect(result.error.statusCode).toBe(503);
  });
});

describe("handleYouTubeCallback", () => {
  it("exchanges code, fetches live streams, returns credentials", async () => {
    const { startYouTubeConnect, handleYouTubeCallback } = await setupService();

    const startResult = startYouTubeConnect("user-1", "creator-1");
    expect(startResult.ok).toBe(true);
    if (!startResult.ok) return;

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "yt-access-token" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            items: [
              {
                cdn: {
                  ingestionInfo: {
                    ingestionAddress: "rtmp://a.rtmp.youtube.com/live2",
                    streamName: "yt-stream-key-xyz",
                  },
                },
              },
            ],
          }),
        }),
    );

    const result = await handleYouTubeCallback("yt-code", startResult.value.state);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.credentials.platform).toBe("youtube");
    expect(result.value.credentials.rtmpUrl).toBe("rtmp://a.rtmp.youtube.com/live2");
    expect(result.value.credentials.streamKey).toBe("yt-stream-key-xyz");
    expect(result.value.userId).toBe("user-1");
    expect(result.value.creatorId).toBe("creator-1");

    vi.unstubAllGlobals();
  });

  it("returns error when no live streams found", async () => {
    const { startYouTubeConnect, handleYouTubeCallback } = await setupService();

    const startResult = startYouTubeConnect("user-1", "creator-1");
    expect(startResult.ok).toBe(true);
    if (!startResult.ok) return;

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "yt-access-token" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [] }),
        }),
    );

    const result = await handleYouTubeCallback("yt-code", startResult.value.state);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("YOUTUBE_NO_STREAMS");

    vi.unstubAllGlobals();
  });

  it("returns error for invalid state", async () => {
    const { handleYouTubeCallback } = await setupService();

    const result = await handleYouTubeCallback("code", "bad-state");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("YOUTUBE_INVALID_STATE");
  });

  it("returns error when state was issued for wrong platform", async () => {
    const { startTwitchConnect, handleYouTubeCallback } = await setupService();

    // Generate a Twitch state but try to use it in YouTube callback
    const startResult = startTwitchConnect("user-1", "creator-1");
    expect(startResult.ok).toBe(true);
    if (!startResult.ok) return;

    const result = await handleYouTubeCallback("code", startResult.value.state);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("YOUTUBE_WRONG_PLATFORM");
  });
});

// ── cleanExpiredStates ──

describe("cleanExpiredStates", () => {
  it("removes expired states without affecting valid ones", async () => {
    const { startTwitchConnect, cleanExpiredStates, handleTwitchCallback } =
      await setupService();

    // Create a state
    const startResult = startTwitchConnect("user-1", "creator-1");
    expect(startResult.ok).toBe(true);
    if (!startResult.ok) return;

    vi.useFakeTimers();
    vi.advanceTimersByTime(11 * 60 * 1000);

    cleanExpiredStates();

    vi.useRealTimers();

    // State should now be gone
    const result = await handleTwitchCallback("code", startResult.value.state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // TWITCH_INVALID_STATE because the map entry was deleted
    expect(result.error.code).toBe("TWITCH_INVALID_STATE");
  });
});
