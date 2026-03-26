import { describe, it, expect, vi, afterEach } from "vitest";

import {
  TEST_CONFIG,
  TEST_SRS_API_URL,
  TEST_SRS_HLS_URL,
  makeTestConfig,
} from "../helpers/test-constants.js";

// ── Mock Helpers ──

const mockFetch = vi.fn();

const mockFetchResponse = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });

const makeSrsStreamsResponse = (
  streams: Array<{ active: boolean; clients: number }> = [],
) => ({
  code: 0,
  streams: streams.map((s) => ({
    publish: { active: s.active },
    clients: s.clients,
  })),
});

// ── Setup Factories ──

const setupSrsService = async () => {
  vi.stubGlobal("fetch", mockFetch);
  vi.doMock("../../src/config.js", () => ({ config: TEST_CONFIG }));
  return await import("../../src/services/srs.js");
};

const setupUnconfiguredSrsService = async () => {
  vi.stubGlobal("fetch", mockFetch);
  vi.doMock("../../src/config.js", () => ({
    config: makeTestConfig({ SRS_API_URL: undefined }),
  }));
  return await import("../../src/services/srs.js");
};

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

// ── Tests ──

describe("srs service", () => {
  describe("getStreamStatus", () => {
    it("returns live status when SRS has active stream", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(
          makeSrsStreamsResponse([{ active: true, clients: 42 }]),
        ),
      );

      const { getStreamStatus } = await setupSrsService();
      const result = await getStreamStatus();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isLive).toBe(true);
        expect(result.value.viewerCount).toBe(42);
        expect(result.value.hlsUrl).toBe(TEST_SRS_HLS_URL);
      }
    });

    it("returns offline when no streams", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeSrsStreamsResponse([])),
      );

      const { getStreamStatus } = await setupSrsService();
      const result = await getStreamStatus();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isLive).toBe(false);
        expect(result.value.viewerCount).toBe(0);
        expect(result.value.hlsUrl).toBeNull();
      }
    });

    it("returns offline when no active streams", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(
          makeSrsStreamsResponse([{ active: false, clients: 0 }]),
        ),
      );

      const { getStreamStatus } = await setupSrsService();
      const result = await getStreamStatus();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isLive).toBe(false);
        expect(result.value.viewerCount).toBe(0);
      }
    });

    it("aggregates viewers across multiple streams", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(
          makeSrsStreamsResponse([
            { active: true, clients: 10 },
            { active: true, clients: 32 },
          ]),
        ),
      );

      const { getStreamStatus } = await setupSrsService();
      const result = await getStreamStatus();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.viewerCount).toBe(42);
      }
    });

    it("calls correct SRS API endpoint", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse(makeSrsStreamsResponse([])),
      );

      const { getStreamStatus } = await setupSrsService();
      await getStreamStatus();

      expect(mockFetch).toHaveBeenCalledWith(
        `${TEST_SRS_API_URL}/api/v1/streams/`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("returns 503 when not configured", async () => {
      const { getStreamStatus } = await setupUnconfiguredSrsService();
      const result = await getStreamStatus();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STREAMING_NOT_CONFIGURED");
        expect(result.error.statusCode).toBe(503);
      }
    });

    it("returns 502 on network error", async () => {
      mockFetch.mockRejectedValue(new Error("connection refused"));

      const { getStreamStatus } = await setupSrsService();
      const result = await getStreamStatus();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SRS_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });

    it("returns 502 on non-ok response", async () => {
      mockFetch.mockReturnValue(mockFetchResponse({}, 500));

      const { getStreamStatus } = await setupSrsService();
      const result = await getStreamStatus();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SRS_ERROR");
        expect(result.error.statusCode).toBe(502);
        expect(result.error.message).toBe("SRS API returned 500");
      }
    });

    it("returns null hlsUrl when HLS URL not configured", async () => {
      vi.stubGlobal("fetch", mockFetch);
      vi.doMock("../../src/config.js", () => ({
        config: makeTestConfig({ SRS_HLS_URL: undefined }),
      }));
      const { getStreamStatus } = await import("../../src/services/srs.js");

      mockFetch.mockReturnValue(
        mockFetchResponse(
          makeSrsStreamsResponse([{ active: true, clients: 5 }]),
        ),
      );

      const result = await getStreamStatus();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hlsUrl).toBeNull();
      }
    });
  });
});
