import { describe, it, expect, vi, afterEach } from "vitest";

import { makeTestConfig } from "../helpers/test-constants.js";

// ── Mock State ──

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();
const mockRegenerateAndRestart = vi.fn();
const mockWaitForHealth = vi.fn();

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
      delete: mockDbDelete,
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
  vi.doMock("../../src/services/liquidsoap-config.js", () => ({
    regenerateAndRestart: mockRegenerateAndRestart,
    waitForHealth: mockWaitForHealth,
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

const buildDeleteWhereChain = () => ({
  where: vi.fn().mockResolvedValue([]),
});

// ── Fixtures ──

const makeChannelRow = (overrides?: Partial<{
  id: string;
  name: string;
  ownership: string;
  role: string;
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
  ownership: "platform",
  role: "playout",
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

    // Priority now keys on identity `role` (broadcast > live-ingest > playout),
    // replacing the legacy `type` priority. The dead `scheduled` tier is gone.
    const ch = (
      id: string,
      ownership: "platform" | "creator",
      role: "playout" | "broadcast" | "live-ingest",
    ) => ({
      id,
      ownership,
      role,
      name: id,
      srsStreamName: id,
      thumbnailUrl: null,
      hlsUrl: null,
      creatorId: ownership === "creator" ? "creator-1" : null,
      creator: null,
      isActive: true,
    });

    it("picks the broadcast tier when available (highest priority)", async () => {
      const { selectDefaultChannel } = await setupService();
      const channels = [
        ch("ch-broadcast", "platform", "broadcast"),
        ch("ch-live", "creator", "live-ingest"),
        ch("ch-playout", "platform", "playout"),
      ];
      const result = selectDefaultChannel(channels);
      expect(result).toBe("ch-broadcast");
    });

    it("picks the live-ingest tier when no broadcast channel", async () => {
      const { selectDefaultChannel } = await setupService();
      const channels = [
        ch("ch-live", "creator", "live-ingest"),
        ch("ch-playout", "platform", "playout"),
      ];
      const result = selectDefaultChannel(channels);
      expect(result).toBe("ch-live");
    });

    it("picks the playout tier when no broadcast or live-ingest", async () => {
      const { selectDefaultChannel } = await setupService();
      const channels = [ch("ch-playout", "platform", "playout")];
      const result = selectDefaultChannel(channels);
      expect(result).toBe("ch-playout");
    });

    it("returns a valid channel id from the highest-priority tier", async () => {
      const { selectDefaultChannel } = await setupService();
      const channels = [
        ch("ch-playout-1", "platform", "playout"),
        ch("ch-playout-2", "platform", "playout"),
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
      const channelRow = makeChannelRow({ ownership: "creator", role: "live-ingest", creatorId: "creator-1" });
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([channelRow]));
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([
        { id: "creator-1", displayName: "Maya", handle: "maya", avatarUrl: null, bannerUrl: null },
      ]));

      const { getActiveChannels } = await setupService();
      const result = await getActiveChannels();

      expect(result[0]?.creator?.displayName).toBe("Maya");
    });
  });

  // findChannelCreatorId is the leak-guard for content.playout-changed: it must
  // return a creatorId ONLY for creator-owned channels, so the queue-transition
  // publishers never emit a creator-scoped event for a platform/admin channel.
  describe("findChannelCreatorId", () => {
    it("returns the creatorId for a creator-owned channel", async () => {
      mockDbSelect.mockReturnValueOnce(
        buildSelectWhereChain([{ ownership: "creator", creatorId: "creator-7" }]),
      );

      const { findChannelCreatorId } = await setupService();
      const result = await findChannelCreatorId("channel-1");

      expect(result).toBe("creator-7");
    });

    it("returns null for a platform channel even when creatorId is populated", async () => {
      // The ownership check — not the creatorId column — is the gate. A stray
      // creatorId on a platform row must NOT leak a creator emit.
      mockDbSelect.mockReturnValueOnce(
        buildSelectWhereChain([{ ownership: "platform", creatorId: "creator-stray" }]),
      );

      const { findChannelCreatorId } = await setupService();
      const result = await findChannelCreatorId("channel-1");

      expect(result).toBeNull();
    });

    it("returns null when the channel does not exist", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([]));

      const { findChannelCreatorId } = await setupService();
      const result = await findChannelCreatorId("missing-channel");

      expect(result).toBeNull();
    });
  });

  describe("ensureCreatorChannel", () => {
    it("creates a new persistent channel when none exists", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([]));
      mockDbInsert.mockReturnValueOnce(buildInsertValuesChain());

      const { ensureCreatorChannel } = await setupService();
      const result = await ensureCreatorChannel("creator-1", "Maya");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.channelId).toBeDefined();
      }
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });

    it("provisions with ownership='creator', role='live-ingest', isActive=false", async () => {
      let insertedValues: Record<string, unknown> | null = null;
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([]));
      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockImplementation((vals) => {
          insertedValues = vals;
          return Promise.resolve([]);
        }),
      });

      const { ensureCreatorChannel } = await setupService();
      await ensureCreatorChannel("creator-1", "Maya");

      expect(insertedValues).not.toBeNull();
      const vals = insertedValues as unknown as Record<string, unknown>;
      expect(vals.creatorId).toBe("creator-1");
      expect(vals.ownership).toBe("creator");
      expect(vals.role).toBe("live-ingest");
      expect(vals.isActive).toBe(false);
      expect(typeof vals.srsStreamName).toBe("string");
      expect((vals.srsStreamName as string).startsWith("creator-")).toBe(true);
    });

    it("is idempotent — returns existing channel when already provisioned", async () => {
      const existingChannel = { id: "channel-existing", createdAt: new Date("2026-01-01") };
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([existingChannel]));

      const { ensureCreatorChannel } = await setupService();
      const result = await ensureCreatorChannel("creator-1", "Maya");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.channelId).toBe("channel-existing");
      }
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it("dedupes duplicate rows — keeps oldest, deletes others", async () => {
      const older = { id: "channel-older", createdAt: new Date("2026-01-01") };
      const newer = { id: "channel-newer", createdAt: new Date("2026-06-01") };
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([older, newer]));
      mockDbDelete.mockReturnValueOnce(buildDeleteWhereChain());

      const { ensureCreatorChannel } = await setupService();
      const result = await ensureCreatorChannel("creator-1", "Maya");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.channelId).toBe("channel-older");
      }
      // Newer duplicate should be deleted
      expect(mockDbDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe("activateLiveChannel", () => {
    it("activates existing persistent channel on publish", async () => {
      const existingChannel = { id: "channel-persistent" };
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([existingChannel]));
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
        expect(result.value.channelId).toBe("channel-persistent");
      }
      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it("reuses same channel row on second publish (publish→unpublish→publish pattern)", async () => {
      const existingChannel = { id: "channel-persistent" };
      // First publish
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([existingChannel]));
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereChain());

      const { activateLiveChannel } = await setupService();
      const result1 = await activateLiveChannel({
        creatorId: "creator-1",
        creatorName: "Maya",
        streamSessionId: "session-1",
        srsStreamName: "livestream",
      });
      expect(result1.ok).toBe(true);
      if (result1.ok) expect(result1.value.channelId).toBe("channel-persistent");

      // Second publish (same persistent channel, new session)
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([existingChannel]));
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereChain());
      const result2 = await activateLiveChannel({
        creatorId: "creator-1",
        creatorName: "Maya",
        streamSessionId: "session-2",
        srsStreamName: "livestream",
      });
      expect(result2.ok).toBe(true);
      if (result2.ok) expect(result2.value.channelId).toBe("channel-persistent");

      // Same channel ID in both results — no new insert
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it("sets name, srsStreamName, streamSessionId, and isActive=true on update", async () => {
      const existingChannel = { id: "channel-persistent" };
      let updatedValues: Record<string, unknown> | null = null;
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([existingChannel]));
      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockImplementation((vals) => {
          updatedValues = vals;
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      });

      const { activateLiveChannel } = await setupService();
      await activateLiveChannel({
        creatorId: "creator-1",
        creatorName: "Maya",
        streamSessionId: "session-new",
        srsStreamName: "livestream",
      });

      expect(updatedValues).not.toBeNull();
      const vals = updatedValues as unknown as Record<string, unknown>;
      expect(vals.name).toBe("Live: Maya");
      expect(vals.srsStreamName).toBe("livestream");
      expect(vals.streamSessionId).toBe("session-new");
      expect(vals.isActive).toBe(true);
      // activate never sets ownership/role — those are fixed at provisioning
      expect(vals.ownership).toBeUndefined();
      expect(vals.role).toBeUndefined();
    });

    it("provisions a fallback row when persistent channel is missing at publish time", async () => {
      // No existing channel (edge case — stream-key creation may have raced)
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
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
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

  describe("deactivatePlayoutChannel", () => {
    it("selects a playout channel, deactivates it, regenerates config, and reports health", async () => {
      const channelRow = makeChannelRow({ id: "playout-1", role: "playout" });
      let updatedValues: Record<string, unknown> | null = null;
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([channelRow]));
      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockImplementation((vals) => {
          updatedValues = vals;
          return { where: vi.fn().mockResolvedValue([]) };
        }),
      });
      mockRegenerateAndRestart.mockResolvedValue({ ok: true, value: undefined });
      mockWaitForHealth.mockResolvedValue(true);

      const { deactivatePlayoutChannel } = await setupService();
      const result = await deactivatePlayoutChannel("playout-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ engineRestarting: true, engineReady: true });
      }
      expect(updatedValues).toEqual(
        expect.objectContaining({ isActive: false, updatedAt: expect.any(Date) }),
      );
      expect(mockRegenerateAndRestart).toHaveBeenCalledTimes(1);
      expect(mockWaitForHealth).toHaveBeenCalledTimes(1);
    });

    it("returns NOT_FOUND when the channel is missing or not a playout channel", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([]));

      const { deactivatePlayoutChannel } = await setupService();
      const result = await deactivatePlayoutChannel("missing");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.message).toBe("Channel not found");
      }
      expect(mockDbUpdate).not.toHaveBeenCalled();
      expect(mockRegenerateAndRestart).not.toHaveBeenCalled();
      expect(mockWaitForHealth).not.toHaveBeenCalled();
    });

    it("preserves the legacy response shape when regenerate fails", async () => {
      const channelRow = makeChannelRow({ id: "playout-1", role: "playout" });
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([channelRow]));
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereChain());
      mockRegenerateAndRestart.mockResolvedValue({ ok: false, error: new Error("restart failed") });

      const { deactivatePlayoutChannel } = await setupService();
      const result = await deactivatePlayoutChannel("playout-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ engineRestarting: false, engineReady: false });
      }
      expect(mockWaitForHealth).not.toHaveBeenCalled();
    });
  });

  describe("ensureBroadcast", () => {
    it("creates broadcast channel on first call", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([]));
      mockDbInsert.mockReturnValueOnce(buildInsertValuesChain());

      const { ensureBroadcast } = await setupService();
      const result = await ensureBroadcast({
        name: "S/NC TV",
        srsStreamName: "snc-tv",
      });

      expect(result.ok).toBe(true);
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });

    it("creates channel with broadcast role and isActive true", async () => {
      let insertedValues: Record<string, unknown> | null = null;
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([]));
      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockImplementation((vals) => {
          insertedValues = vals;
          return Promise.resolve([]);
        }),
      });

      const { ensureBroadcast } = await setupService();
      await ensureBroadcast({ name: "S/NC TV", srsStreamName: "snc-tv" });

      expect(insertedValues).not.toBeNull();
      const vals = insertedValues as unknown as Record<string, unknown>;
      expect(vals.ownership).toBe("platform");
      expect(vals.role).toBe("broadcast");
      expect(vals.isActive).toBe(true);
    });

    it("sets defaultPlayoutChannelId when provided", async () => {
      let insertedValues: Record<string, unknown> | null = null;
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([]));
      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockImplementation((vals) => {
          insertedValues = vals;
          return Promise.resolve([]);
        }),
      });

      const { ensureBroadcast } = await setupService();
      await ensureBroadcast({
        name: "S/NC TV",
        srsStreamName: "snc-tv",
        defaultPlayoutChannelId: "playout-channel-1",
      });

      expect(insertedValues).not.toBeNull();
      const vals = insertedValues as unknown as Record<string, unknown>;
      expect(vals.defaultPlayoutChannelId).toBe("playout-channel-1");
    });

    it("is idempotent on second call (updates instead of inserting)", async () => {
      const existingChannel = { id: "broadcast-existing", isActive: true };
      mockDbSelect.mockReturnValueOnce(buildSelectWhereEqChain([existingChannel]));
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereChain());

      const { ensureBroadcast } = await setupService();
      const result = await ensureBroadcast({
        name: "S/NC TV",
        srsStreamName: "snc-tv",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.channelId).toBe("broadcast-existing");
      }
      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
      expect(mockDbInsert).not.toHaveBeenCalled();
    });
  });

  describe("selectDefaultChannel with broadcast", () => {
    it("returns broadcast channel over all other roles", async () => {
      const { selectDefaultChannel } = await setupService();
      const channels = [
        { id: "ch-broadcast", ownership: "platform" as const, role: "broadcast" as const, name: "b", srsStreamName: "snc-tv", thumbnailUrl: null, hlsUrl: null, creatorId: null, creator: null, isActive: true },
        { id: "ch-live", ownership: "creator" as const, role: "live-ingest" as const, name: "l", srsStreamName: "l", thumbnailUrl: null, hlsUrl: null, creatorId: "creator-1", creator: null, isActive: true },
        { id: "ch-playout", ownership: "platform" as const, role: "playout" as const, name: "p", srsStreamName: "p", thumbnailUrl: null, hlsUrl: null, creatorId: null, creator: null, isActive: true },
      ];
      const result = selectDefaultChannel(channels);
      expect(result).toBe("ch-broadcast");
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
