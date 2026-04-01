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
  elapsed: 30.0,
  remaining: 60.0,
});

// ── Setup Factories ──

const setupModule = async (withApiUrl = true) => {
  vi.stubGlobal("fetch", mockFetch);
  vi.doMock("../../src/config.js", () => ({
    config: makeTestConfig({
      LIQUIDSOAP_API_URL: withApiUrl ? "http://localhost:8888" : undefined,
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

    it("returns parsed now-playing data on success", async () => {
      const { createLiquidsoapClient } = await setupModule();
      const client = createLiquidsoapClient();
      mockFetch.mockReturnValue(mockFetchResponse(makeNowPlayingResponse()));

      const result = await client.getNowPlaying("channel-1");

      expect(result).not.toBeNull();
      expect(result?.uri).toBe("s3://snc-storage/playout/item-1/1080p.mp4");
      expect(result?.title).toBe("Test Film");
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
});
