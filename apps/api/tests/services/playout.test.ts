import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { makeTestConfig } from "../helpers/test-constants.js";

// ── Mock State ──

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();
const mockDbExecute = vi.fn().mockResolvedValue(undefined);
const mockGetLiquidsoapNowPlaying = vi.fn().mockResolvedValue(null);

// ── Orchestrator mock state ──
const mockGetChannelQueueStatus = vi.fn().mockResolvedValue({ ok: true, value: { nowPlaying: null, upcoming: [], poolSize: 0 } });
const mockInsertIntoQueue = vi.fn().mockResolvedValue({ ok: true, value: { id: "queue-1" } });
const mockSkip = vi.fn().mockResolvedValue({ ok: true, value: undefined });

// ── Fixtures ──

const makeItemRow = (overrides: Record<string, unknown> = {}) => ({
  id: "item-1",
  title: "Test Film",
  year: 2020,
  director: "Test Director",
  s3KeyPrefix: "playout/item-1",
  sourceKey: "playout/item-1/source.mp4",
  sourceWidth: 1920,
  sourceHeight: 1080,
  duration: 90.0,
  rendition1080pKey: "playout/item-1/1080p.mp4",
  rendition720pKey: null,
  rendition480pKey: null,
  renditionAudioKey: null,
  subtitleKey: null,
  processingStatus: "ready",
  position: 0,
  enabled: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

const makeChannelRow = (overrides: Record<string, unknown> = {}) => ({
  id: "channel-1",
  type: "playout",
  isActive: true,
  ...overrides,
});

// ── DB Chain Helpers ──

const buildSelectOrderByChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    orderBy: vi.fn().mockResolvedValue(rows),
  }),
});

const buildSelectWhereChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(rows),
  }),
});

const buildUpdateSetWhereReturningChain = (rows: unknown[]) => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(rows),
    }),
  }),
});

const buildInsertValuesReturningChain = (rows: unknown[]) => ({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(rows),
  }),
});

const buildDeleteWhereReturningChain = (rows: unknown[]) => ({
  where: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(rows),
  }),
});

// ── Setup Factory ──

const setupService = async () => {
  vi.doMock("../../src/config.js", () => ({
    config: makeTestConfig({
      S3_BUCKET: "snc-storage",
    }),
  }));
  vi.doMock("../../src/db/connection.js", () => ({
    db: {
      select: mockDbSelect,
      insert: mockDbInsert,
      update: mockDbUpdate,
      delete: mockDbDelete,
      execute: mockDbExecute,
    },
    sql: vi.fn(),
  }));
  vi.doMock("../../src/db/schema/playout.schema.js", () => ({
    playoutItems: {
      id: "id",
      title: "title",
      year: "year",
      director: "director",
      s3KeyPrefix: "s3_key_prefix",
      sourceKey: "source_key",
      sourceWidth: "source_width",
      sourceHeight: "source_height",
      duration: "duration",
      rendition1080pKey: "rendition_1080p_key",
      rendition720pKey: "rendition_720p_key",
      rendition480pKey: "rendition_480p_key",
      renditionAudioKey: "rendition_audio_key",
      subtitleKey: "subtitle_key",
      processingStatus: "processing_status",
      position: "position",
      enabled: "enabled",
      createdAt: "created_at",
      updatedAt: "updated_at",
      $inferSelect: {},
    },
  }));
  vi.doMock("../../src/db/schema/streaming.schema.js", () => ({
    channels: {
      id: "id",
      type: "type",
      isActive: "is_active",
      $inferSelect: {},
    },
  }));
  vi.doMock("../../src/services/liquidsoap.js", () => ({
    getNowPlaying: mockGetLiquidsoapNowPlaying,
  }));
  vi.doMock("../../src/routes/playout-channels.init.js", () => ({
    orchestrator: {
      getChannelQueueStatus: mockGetChannelQueueStatus,
      insertIntoQueue: mockInsertIntoQueue,
      skip: mockSkip,
    },
  }));
  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: {
      child: vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      }),
    },
  }));
  return await import("../../src/services/playout.js");
};

// Restore defaults before each test (vitest's mockReset:true runs after afterEach,
// so defaults must be set in beforeEach to survive into the test body).
beforeEach(() => {
  mockDbExecute.mockResolvedValue(undefined);
  mockGetLiquidsoapNowPlaying.mockResolvedValue(null);
  mockGetChannelQueueStatus.mockResolvedValue({ ok: true, value: { nowPlaying: null, upcoming: [], poolSize: 0 } });
  mockInsertIntoQueue.mockResolvedValue({ ok: true, value: { id: "queue-1" } });
  mockSkip.mockResolvedValue({ ok: true, value: undefined });
});

afterEach(() => {
  vi.resetModules();
});

// ── Tests ──

describe("listPlayoutItems", () => {
  it("returns all items ordered by position", async () => {
    const { listPlayoutItems } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectOrderByChain([makeItemRow()]));

    const items = await listPlayoutItems();

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("item-1");
    expect(items[0]?.title).toBe("Test Film");
  });

  it("maps renditions correctly", async () => {
    const { listPlayoutItems } = await setupService();
    mockDbSelect.mockReturnValue(
      buildSelectOrderByChain([
        makeItemRow({ rendition1080pKey: "playout/item-1/1080p.mp4", rendition720pKey: null }),
      ]),
    );

    const items = await listPlayoutItems();

    expect(items[0]?.renditions["1080p"]).toBe(true);
    expect(items[0]?.renditions["720p"]).toBe(false);
    expect(items[0]?.renditions.source).toBe(true);
  });

  it("maps hasSubtitles correctly", async () => {
    const { listPlayoutItems } = await setupService();
    mockDbSelect.mockReturnValue(
      buildSelectOrderByChain([makeItemRow({ subtitleKey: "playout/item-1/subtitles.vtt" })]),
    );

    const items = await listPlayoutItems();
    expect(items[0]?.hasSubtitles).toBe(true);
  });
});

describe("getPlayoutItem", () => {
  it("returns item when found", async () => {
    const { getPlayoutItem } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeItemRow()]));

    const result = await getPlayoutItem("item-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe("item-1");
    }
  });

  it("returns NotFoundError when item not found", async () => {
    const { getPlayoutItem } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([]));

    const result = await getPlayoutItem("nonexistent");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.statusCode).toBe(404);
    }
  });
});

describe("createPlayoutItem", () => {
  it("creates item with position at end of playlist", async () => {
    const { createPlayoutItem } = await setupService();
    // First select is for max position
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([{ max: 2 }]),
      })
      .mockReturnValue(buildSelectOrderByChain([]));
    mockDbInsert.mockReturnValue(buildInsertValuesReturningChain([makeItemRow({ position: 3 })]));

    const result = await createPlayoutItem({ title: "Test Film" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe("Test Film");
    }
  });
});

describe("getPlayoutNowPlaying", () => {
  it("returns null when Liquidsoap returns null", async () => {
    const { getPlayoutNowPlaying } = await setupService();
    mockGetLiquidsoapNowPlaying.mockResolvedValue(null);

    const result = await getPlayoutNowPlaying();
    expect(result).toBeNull();
  });

  it("enriches now-playing with DB item metadata", async () => {
    const { getPlayoutNowPlaying } = await setupService();
    mockGetLiquidsoapNowPlaying.mockResolvedValue({
      uri: "s3://snc-storage/playout/item-1/1080p.mp4",
      title: "Raw Title",
      duration: 90.0,
      elapsed: 30.0,
      remaining: 60.0,
    });
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeItemRow()]));

    const result = await getPlayoutNowPlaying();

    expect(result).not.toBeNull();
    expect(result?.itemId).toBe("item-1");
    expect(result?.title).toBe("Test Film"); // DB title preferred over raw
    expect(result?.year).toBe(2020);
    expect(result?.director).toBe("Test Director");
    expect(result?.elapsed).toBe(30.0);
    expect(result?.remaining).toBe(60.0);
  });

  it("returns partial data when URI does not match playout pattern", async () => {
    const { getPlayoutNowPlaying } = await setupService();
    mockGetLiquidsoapNowPlaying.mockResolvedValue({
      uri: "file:///some/local/file.mp4",
      title: "Local File",
      duration: 30.0,
      elapsed: 5.0,
      remaining: 25.0,
    });

    const result = await getPlayoutNowPlaying();

    expect(result).not.toBeNull();
    expect(result?.itemId).toBeNull();
    expect(result?.title).toBe("Local File");
  });
});

describe("skipCurrentTrack", () => {
  it("delegates to orchestrator.skip", async () => {
    const { skipCurrentTrack } = await setupService();
    // Channel lookup returns a channel
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeChannelRow()]));
    mockSkip.mockResolvedValue({ ok: true, value: undefined });

    const result = await skipCurrentTrack();
    expect(result.ok).toBe(true);
    expect(mockSkip).toHaveBeenCalledWith("channel-1");
  });

  it("returns error when no active playout channel found", async () => {
    const { skipCurrentTrack } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([]));

    const result = await skipCurrentTrack();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_PLAYOUT_CHANNEL");
    }
  });
});

describe("queuePlayoutItem", () => {
  it("returns NotFoundError when item not found", async () => {
    const { queuePlayoutItem } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([]));

    const result = await queuePlayoutItem("nonexistent");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.statusCode).toBe(404);
    }
  });

  it("returns error when no rendition available", async () => {
    const { queuePlayoutItem } = await setupService();
    mockDbSelect.mockReturnValue(
      buildSelectWhereChain([
        makeItemRow({
          rendition1080pKey: null,
          rendition720pKey: null,
          rendition480pKey: null,
          sourceKey: null,
        }),
      ]),
    );

    const result = await queuePlayoutItem("item-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_RENDITION");
    }
  });

  it("delegates to orchestrator.insertIntoQueue with correct channelId", async () => {
    const { queuePlayoutItem } = await setupService();
    // First select: item lookup, second select: channel lookup
    mockDbSelect
      .mockReturnValueOnce(buildSelectWhereChain([makeItemRow()]))
      .mockReturnValueOnce(buildSelectWhereChain([makeChannelRow()]));
    mockInsertIntoQueue.mockResolvedValue({ ok: true, value: { id: "queue-1" } });

    const result = await queuePlayoutItem("item-1");

    expect(result.ok).toBe(true);
    expect(mockInsertIntoQueue).toHaveBeenCalledWith("channel-1", "item-1");
  });

  it("returns error when no active playout channel found", async () => {
    const { queuePlayoutItem } = await setupService();
    // item found but no channel
    mockDbSelect
      .mockReturnValueOnce(buildSelectWhereChain([makeItemRow()]))
      .mockReturnValueOnce(buildSelectWhereChain([]));

    const result = await queuePlayoutItem("item-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_PLAYOUT_CHANNEL");
    }
  });
});

describe("getPlayoutStatus", () => {
  it("returns empty status when no active playout channel", async () => {
    const { getPlayoutStatus } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([]));

    const status = await getPlayoutStatus();

    expect(status.queuedItems).toEqual([]);
    expect(status.nowPlaying).toBeNull();
  });

  it("returns empty status when orchestrator returns no playing item", async () => {
    const { getPlayoutStatus } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeChannelRow()]));
    mockGetChannelQueueStatus.mockResolvedValue({
      ok: true,
      value: { nowPlaying: null, upcoming: [], poolSize: 0 },
    });

    const status = await getPlayoutStatus();

    expect(status.queuedItems).toEqual([]);
    expect(status.nowPlaying).toBeNull();
  });

  it("maps orchestrator queue status to PlayoutStatus shape", async () => {
    const { getPlayoutStatus } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeChannelRow()]));
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
        upcoming: [
          {
            id: "queue-2",
            playoutItemId: "item-2",
            title: "Film Two",
            duration: 60.0,
            status: "queued",
            createdAt: "2026-01-01T00:01:00.000Z",
          },
        ],
        poolSize: 5,
      },
    });

    const status = await getPlayoutStatus();

    expect(status.nowPlaying).not.toBeNull();
    expect(status.nowPlaying?.itemId).toBe("item-1");
    expect(status.nowPlaying?.title).toBe("Test Film");
    expect(status.nowPlaying?.elapsed).toBe(-1);
    expect(status.nowPlaying?.remaining).toBe(-1);
    expect(status.queuedItems).toHaveLength(1);
    expect(status.queuedItems[0]?.itemId).toBe("item-2");
    expect(status.queuedItems[0]?.title).toBe("Film Two");
  });
});

describe("getApplicableRenditions (via import)", () => {
  it("returns audio only for null resolution", async () => {
    await setupService();
    const { getApplicableRenditions } = await import("../../src/services/media-processing.js");
    expect(getApplicableRenditions(null, null)).toEqual(["audio"]);
  });
});

describe("updatePlayoutItem", () => {
  it("updates item without triggering playlist regeneration", async () => {
    const { updatePlayoutItem } = await setupService();
    mockDbUpdate.mockReturnValue(buildUpdateSetWhereReturningChain([makeItemRow({ title: "Updated" })]));

    const result = await updatePlayoutItem("item-1", { title: "Updated" });

    expect(result.ok).toBe(true);
  });

  it("returns NotFoundError when item not found", async () => {
    const { updatePlayoutItem } = await setupService();
    mockDbUpdate.mockReturnValue(buildUpdateSetWhereReturningChain([]));

    const result = await updatePlayoutItem("nonexistent", { title: "X" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.statusCode).toBe(404);
    }
  });
});
