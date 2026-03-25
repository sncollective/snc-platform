import { describe, it, expect, vi, afterEach } from "vitest";

import {
  TEST_CONFIG,
  TEST_OWNCAST_URL,
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

// ── Setup Factories ──

const setupOwncastService = async () => {
  vi.stubGlobal("fetch", mockFetch);
  vi.doMock("../../src/config.js", () => ({ config: TEST_CONFIG }));
  return await import("../../src/services/owncast.js");
};

const setupUnconfiguredOwncastService = async () => {
  vi.stubGlobal("fetch", mockFetch);
  vi.doMock("../../src/config.js", () => ({
    config: makeTestConfig({ OWNCAST_URL: undefined }),
  }));
  return await import("../../src/services/owncast.js");
};

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

// ── Tests ──

describe("owncast service", () => {
  describe("getStreamStatus", () => {
    it("returns stream status on success", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse({
          online: true,
          viewerCount: 42,
          lastConnectTime: "2026-03-18T10:00:00Z",
          lastDisconnectTime: null,
        }),
      );

      const { getStreamStatus } = await setupOwncastService();
      const result = await getStreamStatus();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.online).toBe(true);
        expect(result.value.viewerCount).toBe(42);
        expect(result.value.lastConnectTime).toBe("2026-03-18T10:00:00Z");
        expect(result.value.lastDisconnectTime).toBeNull();
      }
    });

    it("calls correct Owncast API endpoint", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse({
          online: false,
          viewerCount: 0,
          lastConnectTime: null,
          lastDisconnectTime: null,
        }),
      );

      const { getStreamStatus } = await setupOwncastService();
      await getStreamStatus();

      expect(mockFetch).toHaveBeenCalledWith(
        `${TEST_OWNCAST_URL}/api/status`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("returns err with 503 when not configured", async () => {
      const { getStreamStatus } = await setupUnconfiguredOwncastService();
      const result = await getStreamStatus();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STREAMING_NOT_CONFIGURED");
        expect(result.error.statusCode).toBe(503);
      }
    });

    it("returns err with 502 on network error", async () => {
      mockFetch.mockRejectedValue(new Error("connection refused"));

      const { getStreamStatus } = await setupOwncastService();
      const result = await getStreamStatus();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("OWNCAST_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });

    it("returns err with 502 on non-ok response", async () => {
      mockFetch.mockReturnValue(mockFetchResponse({}, 500));

      const { getStreamStatus } = await setupOwncastService();
      const result = await getStreamStatus();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("OWNCAST_ERROR");
        expect(result.error.statusCode).toBe(502);
        expect(result.error.message).toBe("Owncast API returned 500");
      }
    });

    it("normalises missing timestamp fields to null", async () => {
      mockFetch.mockReturnValue(
        mockFetchResponse({
          online: false,
          viewerCount: 0,
        }),
      );

      const { getStreamStatus } = await setupOwncastService();
      const result = await getStreamStatus();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.lastConnectTime).toBeNull();
        expect(result.value.lastDisconnectTime).toBeNull();
      }
    });
  });
});
