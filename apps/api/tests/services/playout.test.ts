import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock State ──

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();
const mockDbExecute = vi.fn().mockResolvedValue(undefined);
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockRename = vi.fn().mockResolvedValue(undefined);
const mockGetLiquidsoapNowPlaying = vi.fn().mockResolvedValue(null);
const mockGetChannelNowPlaying = vi.fn().mockResolvedValue(null);
const mockSkipTrack = vi.fn().mockResolvedValue({ ok: true, value: undefined });
const mockQueueTrack = vi.fn().mockResolvedValue({ ok: true, value: undefined });
const mockReloadPlaylist = vi.fn().mockResolvedValue(undefined);

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

const buildSelectWhereOrderByChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue(rows),
    }),
  }),
});

const buildSelectWhereOrderByAndChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue(rows),
    }),
  }),
});

const buildUpdateSetWhereReturningChain = (rows: unknown[]) => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(rows),
    }),
  }),
});

const buildUpdateSetWhereChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
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
  vi.doMock("node:fs/promises", () => ({
    writeFile: mockWriteFile,
    rename: mockRename,
  }));
  vi.doMock("../../src/services/liquidsoap.js", () => ({
    getNowPlaying: mockGetLiquidsoapNowPlaying,
    getChannelNowPlaying: mockGetChannelNowPlaying,
    skipTrack: mockSkipTrack,
    queueTrack: mockQueueTrack,
    reloadPlaylist: mockReloadPlaylist,
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
  mockWriteFile.mockResolvedValue(undefined);
  mockRename.mockResolvedValue(undefined);
  mockGetLiquidsoapNowPlaying.mockResolvedValue(null);
  mockGetChannelNowPlaying.mockResolvedValue(null);
  mockSkipTrack.mockResolvedValue({ ok: true, value: undefined });
  mockQueueTrack.mockResolvedValue({ ok: true, value: undefined });
  mockReloadPlaylist.mockResolvedValue(undefined);
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

describe("regeneratePlaylist", () => {
  it("writes #EXTM3U header and annotate-wrapped URIs", async () => {
    const { regeneratePlaylist } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectWhereOrderByChain([makeItemRow()]));

    await regeneratePlaylist();

    const written: string = mockWriteFile.mock.calls[0]?.[1] as string;
    expect(written).toContain("#EXTM3U");
    expect(written).toContain('annotate:s3_uri="s3://snc-storage/playout/item-1/1080p.mp4":s3://snc-storage/playout/item-1/1080p.mp4');
  });

  it("includes #EXTINF line when duration is set", async () => {
    const { regeneratePlaylist } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectWhereOrderByChain([makeItemRow({ duration: 90.5 })]));

    await regeneratePlaylist();

    const written: string = mockWriteFile.mock.calls[0]?.[1] as string;
    expect(written).toContain("#EXTINF:91,Test Film");
  });

  it("prefers 1080p rendition URI", async () => {
    const { regeneratePlaylist } = await setupService();
    mockDbSelect.mockReturnValue(
      buildSelectWhereOrderByChain([
        makeItemRow({ rendition1080pKey: "playout/item-1/1080p.mp4", rendition720pKey: "playout/item-1/720p.mp4" }),
      ]),
    );

    await regeneratePlaylist();

    const written: string = mockWriteFile.mock.calls[0]?.[1] as string;
    expect(written).toContain("s3://snc-storage/playout/item-1/1080p.mp4");
    expect(written).not.toContain("720p");
  });

  it("skips items with no rendition", async () => {
    const { regeneratePlaylist } = await setupService();
    mockDbSelect.mockReturnValue(
      buildSelectWhereOrderByChain([
        makeItemRow({
          rendition1080pKey: null,
          rendition720pKey: null,
          rendition480pKey: null,
          sourceKey: null,
        }),
      ]),
    );

    await regeneratePlaylist();

    const written: string = mockWriteFile.mock.calls[0]?.[1] as string;
    const lines = written.split("\n").filter(Boolean);
    expect(lines).toHaveLength(1); // only #EXTM3U header
  });

  it("renames temp file to final path atomically", async () => {
    const { regeneratePlaylist } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectWhereOrderByChain([]));

    await regeneratePlaylist();

    expect(mockRename).toHaveBeenCalledTimes(1);
    const [tmpPath, finalPath] = mockRename.mock.calls[0] as [string, string];
    expect(tmpPath).toMatch(/\.tmp$/);
    expect(finalPath).not.toMatch(/\.tmp$/);
  });

  it("calls reloadPlaylist after writing the file", async () => {
    const { regeneratePlaylist } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectWhereOrderByChain([makeItemRow()]));

    await regeneratePlaylist();

    expect(mockReloadPlaylist).toHaveBeenCalledTimes(1);
  });

  it("calls reloadPlaylist after rename (file write completes first)", async () => {
    const { regeneratePlaylist } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectWhereOrderByChain([]));

    const callOrder: string[] = [];
    mockRename.mockImplementation(async () => { callOrder.push("rename"); });
    mockReloadPlaylist.mockImplementation(async () => { callOrder.push("reload"); });

    await regeneratePlaylist();

    expect(callOrder).toEqual(["rename", "reload"]);
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
  it("delegates to skipTrack from liquidsoap service", async () => {
    const { skipCurrentTrack } = await setupService();
    const result = await skipCurrentTrack();
    expect(result.ok).toBe(true);
    expect(mockSkipTrack).toHaveBeenCalledTimes(1);
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

  it("queues the correct S3 URI (prefers 1080p)", async () => {
    const { queuePlayoutItem } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeItemRow()]));
    mockQueueTrack.mockResolvedValue({ ok: true, value: undefined });

    await queuePlayoutItem("item-1");

    expect(mockQueueTrack).toHaveBeenCalledWith(
      "s3://snc-storage/playout/item-1/1080p.mp4",
      "channel-classics",
    );
  });
});

describe("getApplicableRenditions (via import)", () => {
  it("returns audio only for null resolution", async () => {
    const { getPlayoutNowPlaying: _ } = await setupService();
    // Test through shared module instead
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
    // regeneratePlaylist writes the M3U — must not be called
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockRename).not.toHaveBeenCalled();
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

describe("savePlaylist", () => {
  it("updates items and regenerates playlist once", async () => {
    const { savePlaylist } = await setupService();
    const row = makeItemRow();
    // savePlaylist calls: db.update per item, then regeneratePlaylist (select), then listPlayoutItems (select)
    mockDbUpdate.mockReturnValue(buildUpdateSetWhereChain());
    mockDbSelect
      .mockReturnValueOnce(buildSelectWhereOrderByChain([row])) // regeneratePlaylist
      .mockReturnValueOnce(buildSelectOrderByChain([row]));     // listPlayoutItems

    const result = await savePlaylist({
      items: [{ id: "item-1", enabled: true, position: 0 }],
    });

    expect(result.ok).toBe(true);
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    // Playlist regeneration: writeFile + rename each called once
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockRename).toHaveBeenCalledTimes(1);
  });

  it("returns updated items ordered by position", async () => {
    const { savePlaylist } = await setupService();
    const item0 = makeItemRow({ id: "item-1", position: 0 });
    const item1 = makeItemRow({ id: "item-2", position: 1 });
    mockDbUpdate.mockReturnValue(buildUpdateSetWhereChain());
    mockDbSelect
      .mockReturnValueOnce(buildSelectWhereOrderByChain([item0, item1])) // regeneratePlaylist
      .mockReturnValueOnce(buildSelectOrderByChain([item0, item1]));     // listPlayoutItems

    const result = await savePlaylist({
      items: [
        { id: "item-1", enabled: true, position: 0 },
        { id: "item-2", enabled: false, position: 1 },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0]?.id).toBe("item-1");
      expect(result.value[1]?.id).toBe("item-2");
    }
  });

  it("calls regeneratePlaylist exactly once regardless of item count", async () => {
    const { savePlaylist } = await setupService();
    const rows = [makeItemRow(), makeItemRow({ id: "item-2" })];
    mockDbUpdate.mockReturnValue(buildUpdateSetWhereChain());
    mockDbSelect
      .mockReturnValueOnce(buildSelectWhereOrderByChain(rows)) // regeneratePlaylist
      .mockReturnValueOnce(buildSelectOrderByChain(rows));     // listPlayoutItems

    await savePlaylist({
      items: [
        { id: "item-1", enabled: true, position: 0 },
        { id: "item-2", enabled: true, position: 1 },
      ],
    });

    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockRename).toHaveBeenCalledTimes(1);
    expect(mockReloadPlaylist).toHaveBeenCalledTimes(1);
  });
});

describe("getPlayoutStatus", () => {
  it("returns empty queuedItems when queue is empty", async () => {
    const { getPlayoutStatus } = await setupService();
    mockGetChannelNowPlaying.mockResolvedValue(null);

    const status = await getPlayoutStatus();

    expect(status.queuedItems).toEqual([]);
    expect(status.nowPlaying).toBeNull();
  });

  it("returns queuedItems after queuePlayoutItem succeeds", async () => {
    const { queuePlayoutItem, getPlayoutStatus } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeItemRow()]));
    mockQueueTrack.mockResolvedValue({ ok: true, value: undefined });
    mockGetChannelNowPlaying.mockResolvedValue(null);

    await queuePlayoutItem("item-1");
    const status = await getPlayoutStatus();

    expect(status.queuedItems).toHaveLength(1);
    expect(status.queuedItems[0]?.itemId).toBe("item-1");
    expect(status.queuedItems[0]?.title).toBe("Test Film");
    expect(typeof status.queuedItems[0]?.queuedAt).toBe("string");
  });

  it("prunes queue entries when now-playing itemId matches", async () => {
    const { queuePlayoutItem, getPlayoutStatus } = await setupService();
    // Queue two items
    mockDbSelect
      .mockReturnValueOnce(buildSelectWhereChain([makeItemRow({ id: "item-1", title: "Film One" })]))
      .mockReturnValueOnce(buildSelectWhereChain([makeItemRow({ id: "item-2", title: "Film Two" })]));
    mockQueueTrack.mockResolvedValue({ ok: true, value: undefined });

    await queuePlayoutItem("item-1");
    await queuePlayoutItem("item-2");

    // Simulate item-1 now playing — should prune item-1 from queue
    mockGetChannelNowPlaying.mockResolvedValue({
      uri: "s3://snc-storage/playout/item-1/1080p.mp4",
      title: "Film One",
      elapsed: 10,
      remaining: 80,
    });
    // DB lookup for getPlayoutNowPlaying enrichment
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeItemRow({ id: "item-1", title: "Film One" })]));

    const status = await getPlayoutStatus();

    // item-1 played, so it and everything before it (nothing) pruned; item-2 remains
    expect(status.queuedItems).toHaveLength(1);
    expect(status.queuedItems[0]?.itemId).toBe("item-2");
  });

  it("does not push to queue when queueTrack fails", async () => {
    const { queuePlayoutItem, getPlayoutStatus } = await setupService();
    mockDbSelect.mockReturnValue(buildSelectWhereChain([makeItemRow()]));
    mockQueueTrack.mockResolvedValue({ ok: false, error: new Error("failed") });
    mockGetChannelNowPlaying.mockResolvedValue(null);

    await queuePlayoutItem("item-1");
    const status = await getPlayoutStatus();

    expect(status.queuedItems).toHaveLength(0);
  });
});
