import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  TEST_CONFIG,
  TEST_SRS_API_URL,
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
  streams: Array<{ active: boolean; clients: number; name?: string }> = [],
) => ({
  code: 0,
  streams: streams.map((s) => ({
    name: s.name ?? "channel-main",
    publish: { active: s.active },
    clients: s.clients,
  })),
});

const mockGetActiveChannels = vi.fn();
const mockSelectDefaultChannel = vi.fn();
const mockGetChannelQueueStatus = vi.fn().mockResolvedValue({ ok: true, value: { nowPlaying: null, upcoming: [], poolSize: 0 } });
const mockGetLiquidsoapNowPlaying = vi.fn().mockResolvedValue(null);

// ── Setup Factories ──

const setupSrsService = async () => {
  vi.stubGlobal("fetch", mockFetch);
  vi.doMock("../../src/config.js", () => ({ config: TEST_CONFIG }));
  vi.doMock("../../src/services/channels.js", () => ({
    getActiveChannels: mockGetActiveChannels,
    selectDefaultChannel: mockSelectDefaultChannel,
  }));
  vi.doMock("../../src/routes/playout-channels.init.js", () => ({
    orchestrator: {
      getChannelQueueStatus: mockGetChannelQueueStatus,
    },
  }));
  vi.doMock("../../src/services/liquidsoap.js", () => ({
    getNowPlaying: mockGetLiquidsoapNowPlaying,
  }));
  return await import("../../src/services/srs.js");
};

const setupUnconfiguredSrsService = async () => {
  vi.stubGlobal("fetch", mockFetch);
  vi.doMock("../../src/config.js", () => ({
    config: makeTestConfig({ SRS_API_URL: undefined }),
  }));
  vi.doMock("../../src/services/channels.js", () => ({
    getActiveChannels: mockGetActiveChannels,
    selectDefaultChannel: mockSelectDefaultChannel,
  }));
  vi.doMock("../../src/routes/playout-channels.init.js", () => ({
    orchestrator: {
      getChannelQueueStatus: mockGetChannelQueueStatus,
    },
  }));
  vi.doMock("../../src/services/liquidsoap.js", () => ({
    getNowPlaying: mockGetLiquidsoapNowPlaying,
  }));
  return await import("../../src/services/srs.js");
};

// Restore defaults before each test (vi.resetAllMocks() in afterEach clears return values)
beforeEach(() => {
  mockGetChannelQueueStatus.mockResolvedValue({ ok: true, value: { nowPlaying: null, upcoming: [], poolSize: 0 } });
  mockGetLiquidsoapNowPlaying.mockResolvedValue(null);
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

// ── Channel Fixture ──

const makeChannel = (overrides?: Partial<{
  id: string;
  name: string;
  type: "playout" | "broadcast" | "live" | "scheduled";
  srsStreamName: string;
  hlsUrl: string | null;
  thumbnailUrl: string | null;
  creatorId: string | null;
  creator: null;
  isActive: boolean;
}>) => ({
  id: "channel-1",
  name: "S/NC Radio",
  type: "playout" as const,
  srsStreamName: "channel-main",
  hlsUrl: "http://srs.test:8080/live/channel-main.m3u8",
  thumbnailUrl: null,
  creatorId: null,
  creator: null,
  isActive: true,
  ...overrides,
});

// ── Tests ──

describe("srs service", () => {
  describe("getChannelList", () => {
    it("returns channels with viewer counts from SRS", async () => {
      const channel = makeChannel();
      mockGetActiveChannels.mockResolvedValue([channel]);
      mockSelectDefaultChannel.mockReturnValue("channel-1");
      mockFetch.mockReturnValue(
        mockFetchResponse(
          makeSrsStreamsResponse([{ active: true, clients: 42, name: "channel-main" }]),
        ),
      );

      const { getChannelList } = await setupSrsService();
      const result = await getChannelList();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.channels).toHaveLength(1);
        expect(result.value.channels[0]?.viewerCount).toBe(42);
        expect(result.value.defaultChannelId).toBe("channel-1");
      }
    });

    it("returns channels with zero viewers when SRS unreachable", async () => {
      const channel = makeChannel();
      mockGetActiveChannels.mockResolvedValue([channel]);
      mockSelectDefaultChannel.mockReturnValue("channel-1");
      mockFetch.mockRejectedValue(new Error("connection refused"));

      const { getChannelList } = await setupSrsService();
      const result = await getChannelList();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.channels).toHaveLength(1);
        expect(result.value.channels[0]?.viewerCount).toBe(0);
      }
    });

    it("returns channels with zero viewers when SRS returns non-ok response", async () => {
      const channel = makeChannel();
      mockGetActiveChannels.mockResolvedValue([channel]);
      mockSelectDefaultChannel.mockReturnValue("channel-1");
      mockFetch.mockReturnValue(mockFetchResponse({}, 500));

      const { getChannelList } = await setupSrsService();
      const result = await getChannelList();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.channels[0]?.viewerCount).toBe(0);
      }
    });

    it("returns 503 when not configured", async () => {
      const { getChannelList } = await setupUnconfiguredSrsService();
      const result = await getChannelList();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STREAMING_NOT_CONFIGURED");
        expect(result.error.statusCode).toBe(503);
      }
    });

    it("calls correct SRS API endpoint", async () => {
      mockGetActiveChannels.mockResolvedValue([]);
      mockSelectDefaultChannel.mockReturnValue(null);
      mockFetch.mockReturnValue(
        mockFetchResponse(makeSrsStreamsResponse([])),
      );

      const { getChannelList } = await setupSrsService();
      await getChannelList();

      expect(mockFetch).toHaveBeenCalledWith(
        `${TEST_SRS_API_URL}/api/v1/streams/`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("returns empty channels list when no active channels", async () => {
      mockGetActiveChannels.mockResolvedValue([]);
      mockSelectDefaultChannel.mockReturnValue(null);
      mockFetch.mockReturnValue(
        mockFetchResponse(makeSrsStreamsResponse([])),
      );

      const { getChannelList } = await setupSrsService();
      const result = await getChannelList();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.channels).toHaveLength(0);
        expect(result.value.defaultChannelId).toBeNull();
      }
    });

    it("returns defaultChannelId from selectDefaultChannel", async () => {
      const channel = makeChannel();
      mockGetActiveChannels.mockResolvedValue([channel]);
      mockSelectDefaultChannel.mockReturnValue("channel-1");
      mockFetch.mockReturnValue(
        mockFetchResponse(makeSrsStreamsResponse([])),
      );

      const { getChannelList } = await setupSrsService();
      const result = await getChannelList();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.defaultChannelId).toBe("channel-1");
      }
    });

    it("enriches playout channels with nowPlaying data from orchestrator", async () => {
      const channel = makeChannel({ type: "playout" });
      mockGetActiveChannels.mockResolvedValue([channel]);
      mockSelectDefaultChannel.mockReturnValue("channel-1");
      mockFetch.mockReturnValue(mockFetchResponse(makeSrsStreamsResponse([])));
      mockGetChannelQueueStatus.mockResolvedValue({
        ok: true,
        value: {
          nowPlaying: {
            id: "queue-1",
            playoutItemId: "item-1",
            title: "Test Film",
            duration: 90.0,
            status: "playing",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          upcoming: [],
          poolSize: 5,
        },
      });

      const { getChannelList } = await setupSrsService();
      const result = await getChannelList();

      expect(result.ok).toBe(true);
      if (result.ok) {
        const np = result.value.channels[0]?.nowPlaying;
        expect(np).not.toBeNull();
        expect(np?.itemId).toBe("item-1");
        expect(np?.title).toBe("Test Film");
        expect(np?.elapsed).toBe(-1);
        expect(np?.remaining).toBe(-1);
      }
    });

    it("sets nowPlaying to null for playout channel when queue is empty", async () => {
      const channel = makeChannel({ type: "playout" });
      mockGetActiveChannels.mockResolvedValue([channel]);
      mockSelectDefaultChannel.mockReturnValue("channel-1");
      mockFetch.mockReturnValue(mockFetchResponse(makeSrsStreamsResponse([])));
      mockGetChannelQueueStatus.mockResolvedValue({
        ok: true,
        value: { nowPlaying: null, upcoming: [], poolSize: 0 },
      });

      const { getChannelList } = await setupSrsService();
      const result = await getChannelList();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.channels[0]?.nowPlaying).toBeNull();
      }
    });

    it("enriches broadcast channels with now-playing from Liquidsoap", async () => {
      const channel = makeChannel({ type: "broadcast" });
      mockGetActiveChannels.mockResolvedValue([channel]);
      mockSelectDefaultChannel.mockReturnValue("channel-1");
      mockFetch.mockReturnValue(mockFetchResponse(makeSrsStreamsResponse([])));
      mockGetLiquidsoapNowPlaying.mockResolvedValue({
        uri: "s3://snc-storage/playout/item-1/1080p.mp4",
        title: "Test Film",
        elapsed: 30.0,
        remaining: 60.0,
      });

      const { getChannelList } = await setupSrsService();
      const result = await getChannelList();

      expect(result.ok).toBe(true);
      if (result.ok) {
        const np = result.value.channels[0]?.nowPlaying;
        expect(np).not.toBeNull();
        expect(np?.title).toBe("Test Film");
        expect(np?.elapsed).toBe(30.0);
        expect(np?.remaining).toBe(60.0);
      }
    });

    it("sets nowPlaying to null for non-playout/broadcast channels", async () => {
      const channel = makeChannel({ type: "live" });
      mockGetActiveChannels.mockResolvedValue([channel]);
      mockSelectDefaultChannel.mockReturnValue("channel-1");
      mockFetch.mockReturnValue(mockFetchResponse(makeSrsStreamsResponse([])));

      const { getChannelList } = await setupSrsService();
      const result = await getChannelList();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.channels[0]?.nowPlaying).toBeNull();
      }
    });
  });
});
