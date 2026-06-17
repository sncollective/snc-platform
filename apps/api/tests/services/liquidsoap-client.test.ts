import { describe, it, expect, vi, afterEach } from "vitest";

import { makeTestConfig } from "../helpers/test-constants.js";

// ── Mock Helpers ──

const mockFetch = vi.fn();

const mockFetchResponse = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });

const makeNowPlayingResponse = () => ({
  uri: "s3://snc-storage/playout/item-1/1080p.mp4",
  title: "Test Film",
  selected: "queue",
  elapsed: 30.0,
  remaining: 60.0,
});

// ── Setup Factories ──

/**
 * Import the module under test with mocked config and fetch.
 *
 * @param withApiUrl - whether to set LIQUIDSOAP_API_URL (default true)
 * @param withSecret - whether to set PLAYOUT_CALLBACK_SECRET (default true)
 */
const setupModule = async (withApiUrl = true, withSecret = true) => {
  vi.stubGlobal("fetch", mockFetch);
  vi.doMock("../../src/config.js", () => ({
    config: makeTestConfig({
      LIQUIDSOAP_API_URL: withApiUrl ? "http://localhost:8888" : undefined,
      PLAYOUT_CALLBACK_SECRET: withSecret
        ? "test-playout-callback-secret-minimum-32-chars"
        : undefined,
    }),
  }));
  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: {
      child: vi.fn().mockReturnValue({
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      }),
    },
  }));
  return await import("../../src/services/liquidsoap-client.js");
};

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

// ── createLiquidsoapClient ──

describe("createLiquidsoapClient", () => {
  describe("pushTrack", () => {
    it("returns err when LIQUIDSOAP_API_URL is not configured", async () => {
      const { createLiquidsoapClient } = await setupModule(false);
      const client = createLiquidsoapClient();
      const result = await client.pushTrack("channel-1", "s3://snc-storage/playout/item-1/1080p.mp4");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LIQUIDSOAP_NOT_CONFIGURED");
        expect(result.error.statusCode).toBe(503);
      }
    });

    it("POSTs to /channels/{channelId}/queue", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse("queued", 200));

      await client.pushTrack("channel-1", "s3://snc-storage/playout/item-1/1080p.mp4");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/channels/channel-1/queue",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("wraps URI with annotate:s3_uri= before POSTing", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      const uri = "s3://snc-storage/playout/item-1/1080p.mp4";
      mockFetch.mockReturnValue(mockFetchResponse("queued", 200));

      await client.pushTrack("channel-1", uri);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: `annotate:s3_uri="${uri}":${uri}`,
          headers: { "Content-Type": "text/plain" },
        }),
      );
    });

    it("returns ok on success", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse("queued", 200));

      const result = await client.pushTrack("channel-1", "s3://snc-storage/playout/item-1/1080p.mp4");
      expect(result.ok).toBe(true);
    });

    it("returns err on non-2xx response", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse({}, 500));

      const result = await client.pushTrack("channel-1", "s3://snc-storage/playout/item-1/1080p.mp4");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LIQUIDSOAP_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });

    it("returns err when Liquidsoap is unreachable", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockRejectedValue(new Error("connection refused"));

      const result = await client.pushTrack("channel-1", "s3://snc-storage/playout/item-1/1080p.mp4");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LIQUIDSOAP_ERROR");
      }
    });

    it("returns err on timeout (AbortError)", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValue(abortError);

      const result = await client.pushTrack("channel-1", "s3://snc-storage/playout/item-1/1080p.mp4");
      expect(result.ok).toBe(false);
    });
  });

  describe("skipTrack", () => {
    it("returns err when LIQUIDSOAP_API_URL is not configured", async () => {
      const { createLiquidsoapClient } = await setupModule(false);
      const client = createLiquidsoapClient();
      const result = await client.skipTrack("channel-1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LIQUIDSOAP_NOT_CONFIGURED");
      }
    });

    it("POSTs to /channels/{channelId}/skip", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse("skipped", 200));

      await client.skipTrack("channel-1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/channels/channel-1/skip",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("returns ok on success", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse("skipped", 200));

      const result = await client.skipTrack("channel-1");
      expect(result.ok).toBe(true);
    });

    it("returns err on non-2xx response", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse({}, 500));

      const result = await client.skipTrack("channel-1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LIQUIDSOAP_ERROR");
      }
    });

    it("returns err when Liquidsoap is unreachable", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockRejectedValue(new Error("connection refused"));

      const result = await client.skipTrack("channel-1");
      expect(result.ok).toBe(false);
    });
  });

  describe("getNowPlaying", () => {
    it("returns null when LIQUIDSOAP_API_URL is not configured", async () => {
      const { createLiquidsoapClient } = await setupModule(false);
      const client = createLiquidsoapClient();
      const result = await client.getNowPlaying("channel-1");
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("GETs /channels/{channelId}/now-playing", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse(makeNowPlayingResponse()));

      await client.getNowPlaying("channel-1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/channels/channel-1/now-playing",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("returns parsed now-playing data including selected field", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse(makeNowPlayingResponse()));

      const result = await client.getNowPlaying("channel-1");

      expect(result).not.toBeNull();
      expect(result?.uri).toBe("s3://snc-storage/playout/item-1/1080p.mp4");
      expect(result?.title).toBe("Test Film");
      expect(result?.selected).toBe("queue");
      expect(result?.elapsed).toBe(30.0);
      expect(result?.remaining).toBe(60.0);
    });

    it("returns null on non-2xx response", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse({}, 500));

      const result = await client.getNowPlaying("channel-1");
      expect(result).toBeNull();
    });

    it("returns null when Liquidsoap is unreachable", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockRejectedValue(new Error("connection refused"));

      const result = await client.getNowPlaying("channel-1");
      expect(result).toBeNull();
    });

    it("returns null on timeout", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValue(abortError);

      const result = await client.getNowPlaying("channel-1");
      expect(result).toBeNull();
    });
  });

  // ── Editorial control verbs (secret-guarded) ──

  describe("setMode", () => {
    it("returns err when PLAYOUT_CALLBACK_SECRET is not configured", async () => {
      const { createLiquidsoapClient } = await setupModule(true, false);
      const client = createLiquidsoapClient();
      const result = await client.setMode("channel-1", "auto");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LIQUIDSOAP_SECRET_NOT_CONFIGURED");
        expect(result.error.statusCode).toBe(503);
      }
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns err when LIQUIDSOAP_API_URL is not configured", async () => {
      const { createLiquidsoapClient } = await setupModule(false, true);
      const client = createLiquidsoapClient();
      const result = await client.setMode("channel-1", "auto");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LIQUIDSOAP_NOT_CONFIGURED");
      }
    });

    it("POSTs mode string to /channels/{channelId}/mode with ?secret=", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse("ok", 200));

      await client.setMode("channel-1", "manual");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/channels/channel-1/mode?secret=test-playout-callback-secret-minimum-32-chars",
        expect.objectContaining({ method: "POST", body: "manual" }),
      );
    });

    it("POSTs 'auto' for auto mode", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse("ok", 200));

      await client.setMode("channel-1", "auto");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/channels/channel-1/mode"),
        expect.objectContaining({ body: "auto" }),
      );
    });

    it("returns ok on success", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse("ok", 200));

      const result = await client.setMode("channel-1", "auto");
      expect(result.ok).toBe(true);
    });

    it("returns err on non-2xx response", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse({}, 401));

      const result = await client.setMode("channel-1", "auto");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LIQUIDSOAP_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });

    it("returns err when Liquidsoap is unreachable", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockRejectedValue(new Error("connection refused"));

      const result = await client.setMode("channel-1", "auto");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LIQUIDSOAP_ERROR");
      }
    });

    it("returns err on timeout", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValue(abortError);

      const result = await client.setMode("channel-1", "auto");
      expect(result.ok).toBe(false);
    });
  });

  describe("armQueue", () => {
    it("returns err when PLAYOUT_CALLBACK_SECRET is not configured", async () => {
      const { createLiquidsoapClient } = await setupModule(true, false);
      const client = createLiquidsoapClient();
      const result = await client.armQueue("channel-1", true);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LIQUIDSOAP_SECRET_NOT_CONFIGURED");
        expect(result.error.statusCode).toBe(503);
      }
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns err when LIQUIDSOAP_API_URL is not configured", async () => {
      const { createLiquidsoapClient } = await setupModule(false, true);
      const client = createLiquidsoapClient();
      const result = await client.armQueue("channel-1", true);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LIQUIDSOAP_NOT_CONFIGURED");
      }
    });

    it("POSTs 'true' to /channels/{channelId}/arm with ?secret= when armed=true", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse("ok", 200));

      await client.armQueue("channel-1", true);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/channels/channel-1/arm?secret=test-playout-callback-secret-minimum-32-chars",
        expect.objectContaining({ method: "POST", body: "true" }),
      );
    });

    it("POSTs 'false' to /channels/{channelId}/arm when armed=false", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse("ok", 200));

      await client.armQueue("channel-1", false);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/channels/channel-1/arm"),
        expect.objectContaining({ body: "false" }),
      );
    });

    it("returns ok on success", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse("ok", 200));

      const result = await client.armQueue("channel-1", true);
      expect(result.ok).toBe(true);
    });

    it("returns err on non-2xx response", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse({}, 401));

      const result = await client.armQueue("channel-1", true);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LIQUIDSOAP_ERROR");
      }
    });

    it("returns err when Liquidsoap is unreachable", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockRejectedValue(new Error("connection refused"));

      const result = await client.armQueue("channel-1", true);
      expect(result.ok).toBe(false);
    });

    it("returns err on timeout", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValue(abortError);

      const result = await client.armQueue("channel-1", true);
      expect(result.ok).toBe(false);
    });
  });

  describe("setManualTier", () => {
    it("returns err when PLAYOUT_CALLBACK_SECRET is not configured", async () => {
      const { createLiquidsoapClient } = await setupModule(true, false);
      const client = createLiquidsoapClient();
      const result = await client.setManualTier("channel-1", 0);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LIQUIDSOAP_SECRET_NOT_CONFIGURED");
        expect(result.error.statusCode).toBe(503);
      }
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns err when LIQUIDSOAP_API_URL is not configured", async () => {
      const { createLiquidsoapClient } = await setupModule(false, true);
      const client = createLiquidsoapClient();
      const result = await client.setManualTier("channel-1", 0);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LIQUIDSOAP_NOT_CONFIGURED");
      }
    });

    it("POSTs tier index string to /channels/{channelId}/manual with ?secret=", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse("ok", 200));

      await client.setManualTier("channel-1", 2);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/channels/channel-1/manual?secret=test-playout-callback-secret-minimum-32-chars",
        expect.objectContaining({ method: "POST", body: "2" }),
      );
    });

    it("POSTs '0' for tier index 0", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse("ok", 200));

      await client.setManualTier("channel-1", 0);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/channels/channel-1/manual"),
        expect.objectContaining({ body: "0" }),
      );
    });

    it("returns ok on success", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse("ok", 200));

      const result = await client.setManualTier("channel-1", 1);
      expect(result.ok).toBe(true);
    });

    it("returns err on non-2xx response", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse({}, 401));

      const result = await client.setManualTier("channel-1", 0);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("LIQUIDSOAP_ERROR");
      }
    });

    it("returns err when Liquidsoap is unreachable", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockRejectedValue(new Error("connection refused"));

      const result = await client.setManualTier("channel-1", 0);
      expect(result.ok).toBe(false);
    });

    it("returns err on timeout", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValue(abortError);

      const result = await client.setManualTier("channel-1", 0);
      expect(result.ok).toBe(false);
    });
  });
});

// ── createStubLiquidsoapClient ──

describe("createStubLiquidsoapClient", () => {
  it("pushTrack returns ok without calling fetch", async () => {
    const { createStubLiquidsoapClient } = await setupModule();
    const client = createStubLiquidsoapClient();

    const result = await client.pushTrack("channel-1", "s3://snc-storage/playout/item-1/1080p.mp4");
    expect(result.ok).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skipTrack returns ok without calling fetch", async () => {
    const { createStubLiquidsoapClient } = await setupModule();
    const client = createStubLiquidsoapClient();

    const result = await client.skipTrack("channel-1");
    expect(result.ok).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("getNowPlaying returns null without calling fetch", async () => {
    const { createStubLiquidsoapClient } = await setupModule();
    const client = createStubLiquidsoapClient();

    const result = await client.getNowPlaying("channel-1");
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("setMode returns ok without calling fetch", async () => {
    const { createStubLiquidsoapClient } = await setupModule();
    const client = createStubLiquidsoapClient();

    const result = await client.setMode("channel-1", "auto");
    expect(result.ok).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("armQueue returns ok without calling fetch", async () => {
    const { createStubLiquidsoapClient } = await setupModule();
    const client = createStubLiquidsoapClient();

    const result = await client.armQueue("channel-1", true);
    expect(result.ok).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("setManualTier returns ok without calling fetch", async () => {
    const { createStubLiquidsoapClient } = await setupModule();
    const client = createStubLiquidsoapClient();

    const result = await client.setManualTier("channel-1", 0);
    expect(result.ok).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
