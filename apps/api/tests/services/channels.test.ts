import { describe, it, expect, vi, afterEach } from "vitest";

import { makeTestConfig } from "../helpers/test-constants.js";

// ── Mock State ──

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

// ── Setup Factory ──

const setupService = async () => {
  vi.doMock("../../src/config.js", () => ({
    config: makeTestConfig(),
  }));
  vi.doMock("../../src/db/connection.js", () => ({
    db: {
      select: mockDbSelect,
      insert: mockDbInsert,
      update: mockDbUpdate,
    },
    sql: vi.fn(),
  }));
  vi.doMock("../../src/db/schema/streaming.schema.js", () => ({
    channels: {
      id: "id",
      name: "name",
      type: "type",
      thumbnailUrl: "thumbnailUrl",
      srsStreamName: "srsStreamName",
      creatorId: "creatorId",
      streamSessionId: "streamSessionId",
      isActive: "isActive",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  }));
  vi.doMock("../../src/db/schema/creator.schema.js", () => ({
    creatorProfiles: {
      id: "id",
      displayName: "displayName",
      handle: "handle",
      avatarUrl: "avatarUrl",
      bannerUrl: "bannerUrl",
    },
  }));
  vi.doMock("../../src/lib/creator-url.js", () => ({
    resolveCreatorUrls: vi.fn().mockReturnValue({ avatarUrl: null, bannerUrl: null }),
  }));

  return await import("../../src/services/channels.js");
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── DB Chain Helpers ──

const buildSelectWhereChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(rows),
  }),
});

const buildSelectWhereEqChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(rows),
  }),
});

const buildInsertValuesChain = () => ({
  values: vi.fn().mockResolvedValue([]),
});

const buildUpdateSetWhereChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  }),
});

// ── Fixtures ──

const makeChannelRow = (overrides?: Partial<{
  id: string;
  name: string;
  type: string;
  thumbnailUrl: string | null;
  srsStreamName: string;
  creatorId: string | null;
  streamSessionId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>) => ({
  id: "channel-1",
  name: "S/NC Radio",
  type: "playout",
  thumbnailUrl: null,
  srsStreamName: "channel-main",
  creatorId: null,
  streamSessionId: null,
  isActive: true,
  createdAt: new Date("2026-03-01T10:00:00Z"),
  updatedAt: new Date("2026-03-01T10:00:00Z"),
  ...overrides,
});

// ── Tests ──

describe("channel service", () => {
  describe("selectDefaultChannel", () => {
    it("returns null for empty list", async () => {
      const { selectDefaultChannel } = await setupService();
      const result = selectDefaultChannel([]);
      expect(result).toBeNull();
    });

    it("picks from scheduled tier when available", async () => {
      const { selectDefaultChannel } = await setupService();
      const channels = [
        { id: "ch-scheduled", type: "scheduled" as const, name: "s", srsStreamName: "s", thumbnailUrl: null, hlsUrl: null, creatorId: null, creator: null, isActive: true },
        { id: "ch-live", type: "live" as const, name: "l", srsStreamName: "l", thumbnailUrl: null, hlsUrl: null, creatorId: null, creator: null, isActive: true },
        { id: "ch-playout", type: "playout" as const, name: "p", srsStreamName: "p", thumbnailUrl: null, hlsUrl: null, creatorId: null, creator: null, isActive: true },
      ];
      // scheduled has highest priority (lowest number = highest), so must be selected
      const result = selectDefaultChannel(channels);
      expect(result).toBe("ch-scheduled");
    });

    it("picks from live tier when no scheduled channels", async () => {
      const { selectDefaultChannel } = await setupService();
      const channels = [
        { id: "ch-live", type: "live" as const, name: "l", srsStreamName: "l", thumbnailUrl: null, hlsUrl: null, creatorId: null, creator: null, isActive: true },
        { id: "ch-playout", type: "playout" as const, name: "p", srsStreamName: "p", thumbnailUrl: null, hlsUrl: null, creatorId: null, creator: null, isActive: true },
      ];
      const result = selectDefaultChannel(channels);
      expect(result).toBe("ch-live");
    });

    it("picks from playout tier when no live or scheduled", async () => {
      const { selectDefaultChannel } = await setupService();
      const channels = [
        { id: "ch-playout", type: "playout" as const, name: "p", srsStreamName: "p", thumbnailUrl: null, hlsUrl: null, creatorId: null, creator: null, isActive: true },
      ];
      const result = selectDefaultChannel(channels);
      expect(result).toBe("ch-playout");
    });

    it("returns a valid channel id from the highest-priority tier", async () => {
      const { selectDefaultChannel } = await setupService();
      const channels = [
        { id: "ch-playout-1", type: "playout" as const, name: "p1", srsStreamName: "p1", thumbnailUrl: null, hlsUrl: null, creatorId: null, creator: null, isActive: true },
        { id: "ch-playout-2", type: "playout" as const, name: "p2", srsStreamName: "p2", thumbnailUrl: null, hlsUrl: null, creatorId: null, creator: null, isActive: true },
      ];
      const result = selectDefaultChannel(channels);
      expect(["ch-playout-1", "ch-playout-2"]).toContain(result);
    });
  });

  describe("getActiveChannels", () => {
    it("returns only active channels", async () => {
      const channelRow = makeChannelRow();
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([channelRow]));

      const { getActiveChannels } = await setupService();
      const result = await getActiveChannels();

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("channel-1");
      expect(result[0]?.isActive).toBe(true);
    });

    it("returns empty array when no active channels", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([]));

      const { getActiveChannels } = await setupService();
      const result = await getActiveChannels();

      expect(result).toHaveLength(0);
    });

    it("constructs hlsUrl from SRS_HLS_URL + srsStreamName", async () => {
      const channelRow = makeChannelRow({ srsStreamName: "channel-main" });
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([channelRow]));

      const { getActiveChannels } = await setupService();
      const result = await getActiveChannels();

      expect(result[0]?.hlsUrl).toBe(
        `http://srs.test:8080/live/livestream.m3u8/channel-main.m3u8`,
      );
    });

    it("includes creator info for live channels with creator", async () => {
      const channelRow = makeChannelRow({ type: "live", creatorId: "creator-1" });
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([channelRow]));
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([
        { id: "creator-1", displayName: "Maya", handle: "maya", avatarUrl: null, bannerUrl: null },
      ]));

      const { getActiveChannels } = await setupService();
      const result = await getActiveChannels();

      expect(result[0]?.creator?.displayName).toBe("Maya");
    });
  });

  describe("createLiveChannel", () => {
    it("creates channel with type live and isActive true", async () => {
      mockDbInsert.mockReturnValueOnce(buildInsertValuesChain());

      const { createLiveChannel } = await setupService();
      const result = await createLiveChannel({
        creatorId: "creator-1",
        creatorName: "Maya",
        streamSessionId: "session-1",
        srsStreamName: "livestream",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.channelId).toBeDefined();
      }
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });

    it("links to streamSessionId and creatorId", async () => {
      let insertedValues: Record<string, unknown> | null = null;
      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockImplementation((vals) => {
          insertedValues = vals;
          return Promise.resolve([]);
        }),
      });

      const { createLiveChannel } = await setupService();
      await createLiveChannel({
        creatorId: "creator-1",
        creatorName: "Maya",
        streamSessionId: "session-1",
        srsStreamName: "livestream",
      });

      expect(insertedValues).not.toBeNull();
      const vals = insertedValues as unknown as Record<string, unknown>;
      expect(vals.creatorId).toBe("creator-1");
      expect(vals.streamSessionId).toBe("session-1");
      expect(vals.type).toBe("live");
      expect(vals.isActive).toBe(true);
    });
  });

  describe("deactivateLiveChannel", () => {
    it("sets isActive to false", async () => {
      const channelRow = { id: "channel-1" };
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([channelRow]));
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereChain());

      const { deactivateLiveChannel } = await setupService();
      const result = await deactivateLiveChannel("session-1");

      expect(result.ok).toBe(true);
      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    });

    it("returns channelId for chat room cleanup", async () => {
      const channelRow = { id: "channel-1" };
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([channelRow]));
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereChain());

      const { deactivateLiveChannel } = await setupService();
      const result = await deactivateLiveChannel("session-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value?.channelId).toBe("channel-1");
      }
    });

    it("returns null when no matching channel found", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([]));

      const { deactivateLiveChannel } = await setupService();
      const result = await deactivateLiveChannel("session-unknown");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("ensurePlayout", () => {
    it("creates channel on first call", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([]));
      mockDbInsert.mockReturnValueOnce(buildInsertValuesChain());

      const { ensurePlayout } = await setupService();
      const result = await ensurePlayout({
        name: "S/NC Radio",
        srsStreamName: "channel-main",
      });

      expect(result.ok).toBe(true);
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });

    it("returns existing channel on second call (idempotent)", async () => {
      const existingChannel = { id: "channel-existing", isActive: true };
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([existingChannel]));
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereChain());

      const { ensurePlayout } = await setupService();
      const result = await ensurePlayout({
        name: "S/NC Radio",
        srsStreamName: "channel-main",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.channelId).toBe("channel-existing");
      }
      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it("activates inactive channel instead of creating a new one", async () => {
      const existingChannel = { id: "channel-inactive", isActive: false };
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([existingChannel]));
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereChain());

      const { ensurePlayout } = await setupService();
      const result = await ensurePlayout({
        name: "S/NC Radio",
        srsStreamName: "channel-main",
      });

      expect(result.ok).toBe(true);
      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
      expect(mockDbInsert).not.toHaveBeenCalled();
    });
  });
});
