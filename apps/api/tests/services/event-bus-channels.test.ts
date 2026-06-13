import { describe, it, expect, vi, afterEach } from "vitest";

import { makeTestConfig } from "../helpers/test-constants.js";

// ── Mock State ──

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockPublish = vi.fn();

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
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    },
    sql: vi.fn(),
  }));

  vi.doMock("../../src/db/schema/streaming.schema.js", () => ({
    channels: {
      id: "id",
      name: "name",
      ownership: "ownership",
      role: "role",
      thumbnailUrl: "thumbnailUrl",
      srsStreamName: "srsStreamName",
      creatorId: "creatorId",
      streamSessionId: "streamSessionId",
      defaultPlayoutChannelId: "defaultPlayoutChannelId",
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

  vi.doMock("../../src/services/event-bus.js", () => ({
    eventBus: {
      publish: mockPublish,
      subscribe: vi.fn(),
      closeAll: vi.fn(),
      connectionCount: vi.fn().mockReturnValue(0),
    },
    createEventBus: vi.fn(),
  }));

  return await import("../../src/services/channels.js");
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── DB Chain Helpers ──

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

// ── Tests ──

describe("channels → eventBus.publish integration", () => {
  describe("activateLiveChannel", () => {
    it("publishes live:true when activating a persistent channel", async () => {
      const existing = { id: "channel-persistent" };
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([existing]));
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereChain());

      const { activateLiveChannel } = await setupService();
      const result = await activateLiveChannel({
        creatorId: "creator-1",
        creatorName: "Maya",
        streamSessionId: "session-1",
        srsStreamName: "livestream",
      });

      expect(result.ok).toBe(true);
      expect(mockPublish).toHaveBeenCalledTimes(1);
      expect(mockPublish).toHaveBeenCalledWith({
        type: "channel.live-state-changed",
        channelId: "channel-persistent",
        live: true,
      });
    });

    it("publishes live:true and self-heals when persistent channel is missing", async () => {
      // No existing row — fallback insert path
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([]));
      mockDbInsert.mockReturnValueOnce(buildInsertValuesChain());

      const { activateLiveChannel } = await setupService();
      const result = await activateLiveChannel({
        creatorId: "creator-1",
        creatorName: "Maya",
        streamSessionId: "session-1",
        srsStreamName: "livestream",
      });

      expect(result.ok).toBe(true);
      expect(mockPublish).toHaveBeenCalledTimes(1);
      expect(mockPublish).toHaveBeenCalledWith({
        type: "channel.live-state-changed",
        channelId: expect.any(String),
        live: true,
      });
    });

    it("publishes the channelId returned in the result value", async () => {
      const existing = { id: "channel-persistent" };
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([existing]));
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereChain());

      const { activateLiveChannel } = await setupService();
      const result = await activateLiveChannel({
        creatorId: "creator-1",
        creatorName: "Maya",
        streamSessionId: "session-1",
        srsStreamName: "livestream",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(mockPublish).toHaveBeenCalledWith({
          type: "channel.live-state-changed",
          channelId: result.value.channelId,
          live: true,
        });
      }
    });
  });

  describe("deactivateLiveChannel", () => {
    it("publishes live:false when deactivating a channel", async () => {
      const channelRow = { id: "channel-1" };
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([channelRow]));
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereChain());

      const { deactivateLiveChannel } = await setupService();
      const result = await deactivateLiveChannel("session-1");

      expect(result.ok).toBe(true);
      expect(mockPublish).toHaveBeenCalledTimes(1);
      expect(mockPublish).toHaveBeenCalledWith({
        type: "channel.live-state-changed",
        channelId: "channel-1",
        live: false,
      });
    });

    it("does NOT publish when no matching channel is found", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([]));

      const { deactivateLiveChannel } = await setupService();
      const result = await deactivateLiveChannel("session-unknown");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
      expect(mockPublish).not.toHaveBeenCalled();
    });
  });
});
