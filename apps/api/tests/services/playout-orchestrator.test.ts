import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import type { LiquidsoapClient } from "../../src/services/liquidsoap-client.js";

// ── Mock Liquidsoap Client ──

const mockPushTrack = vi.fn();
const mockSkipTrack = vi.fn();
const mockGetNowPlaying = vi.fn();

const mockLiquidsoapClient: LiquidsoapClient = {
  pushTrack: mockPushTrack,
  skipTrack: mockSkipTrack,
  getNowPlaying: mockGetNowPlaying,
};

// ── Mock DB State ──

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();
const mockDbExecute = vi.fn();

// ── Fixtures ──

const makeChannelRow = (overrides: Record<string, unknown> = {}) => ({
  id: "channel-1",
  name: "S/NC Classics",
  type: "playout",
  thumbnailUrl: null,
  srsStreamName: "classics",
  creatorId: null,
  streamSessionId: null,
  defaultPlayoutChannelId: null,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

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

const makeQueueRow = (overrides: Record<string, unknown> = {}) => ({
  id: "entry-1",
  channelId: "channel-1",
  playoutItemId: "item-1",
  position: 1,
  status: "queued",
  pushedToLiquidsoap: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

const makeContentRow = (overrides: Record<string, unknown> = {}) => ({
  id: "cc-1",
  channelId: "channel-1",
  playoutItemId: "item-1",
  contentId: null,
  sourceType: "playout" as const,
  title: "Test Film",
  duration: 90.0,
  lastPlayedAt: null,
  playCount: 0,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

// ── Setup ──

const setupModule = async () => {
  vi.doMock("../../src/db/connection.js", () => ({
    db: {
      select: mockDbSelect,
      insert: mockDbInsert,
      update: mockDbUpdate,
      delete: mockDbDelete,
      execute: mockDbExecute,
    },
  }));

  vi.doMock("../../src/db/schema/playout-queue.schema.js", () => ({
    channelContent: { id: {}, channelId: {}, playoutItemId: {}, contentId: {}, lastPlayedAt: {}, playCount: {}, createdAt: {} },
    playoutQueue: { id: {}, channelId: {}, playoutItemId: {}, position: {}, status: {}, pushedToLiquidsoap: {}, createdAt: {} },
  }));

  vi.doMock("../../src/db/schema/playout.schema.js", () => ({
    playoutItems: { id: {}, title: {}, duration: {}, processingStatus: {}, rendition1080pKey: {}, rendition720pKey: {}, rendition480pKey: {}, sourceKey: {} },
  }));

  vi.doMock("../../src/db/schema/content.schema.js", () => ({
    content: { id: {}, title: {}, duration: {}, type: {}, processingStatus: {}, mediaKey: {}, transcodedMediaKey: {}, creatorId: {} },
  }));

  vi.doMock("../../src/db/schema/creator.schema.js", () => ({
    creatorProfiles: { id: {}, displayName: {} },
  }));

  vi.doMock("../../src/db/schema/streaming.schema.js", () => ({
    channels: { id: {}, name: {}, type: {}, isActive: {} },
  }));

  vi.doMock("../../src/config.js", () => ({
    config: {
      S3_BUCKET: "snc-storage",
    },
  }));

  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: {
      child: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
    },
  }));

  const { createPlayoutOrchestrator } = await import(
    "../../src/services/playout-orchestrator.js"
  );

  return createPlayoutOrchestrator(mockLiquidsoapClient);
};

// ── DB Chain Helpers ──

/**
 * Build a select chain that returns `rows` after .from().where().innerJoin().orderBy()
 * or .from().where() depending on the test case.
 */
const buildSelectChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(rows),
        }),
      }),
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
      limit: vi.fn().mockResolvedValue(rows),
    }),
    innerJoin: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  }),
});

const buildInsertChain = (rows: unknown[]) => ({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(rows),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  }),
});

const buildUpdateChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  }),
});

const buildDeleteChain = () => ({
  where: vi.fn().mockResolvedValue([]),
});

// ── Tests ──

describe("playout orchestrator", () => {
  afterEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  beforeEach(() => {
    mockPushTrack.mockResolvedValue({ ok: true, value: undefined });
    mockSkipTrack.mockResolvedValue({ ok: true, value: undefined });
  });

  // ── assignContent ──

  describe("assignContent", () => {
    it("inserts channel_content entries for given playout item IDs", async () => {
      const orchestrator = await setupModule();

      const insertChain = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      };
      mockDbInsert.mockReturnValue(insertChain);

      const result = await orchestrator.assignContent("channel-1", [
        "item-1",
        "item-2",
      ]);

      expect(result.ok).toBe(true);
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
      const values = insertChain.values.mock.calls[0]?.[0] as Array<{ playoutItemId: string }>;
      expect(values).toHaveLength(2);
      expect(values.map((v) => v.playoutItemId)).toEqual(["item-1", "item-2"]);
      expect(insertChain.values.mock.results[0]?.value.onConflictDoNothing).toHaveBeenCalled();
    });

    it("uses onConflictDoNothing to ignore duplicate assignments", async () => {
      const orchestrator = await setupModule();

      const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({ onConflictDoNothing }),
      });

      await orchestrator.assignContent("channel-1", ["item-1"]);

      expect(onConflictDoNothing).toHaveBeenCalled();
    });

    it("inserts channel_content entries for given content IDs", async () => {
      const orchestrator = await setupModule();

      const insertChain = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      };
      mockDbInsert.mockReturnValue(insertChain);

      const result = await orchestrator.assignContent("channel-1", [], ["content-1", "content-2"]);

      expect(result.ok).toBe(true);
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
      const values = insertChain.values.mock.calls[0]?.[0] as Array<{ contentId: string; playoutItemId: null }>;
      expect(values).toHaveLength(2);
      expect(values.map((v) => v.contentId)).toEqual(["content-1", "content-2"]);
      expect(values.every((v) => v.playoutItemId === null)).toBe(true);
    });

    it("inserts mixed playout and content entries in one call", async () => {
      const orchestrator = await setupModule();

      const insertChain = {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      };
      mockDbInsert.mockReturnValue(insertChain);

      const result = await orchestrator.assignContent("channel-1", ["item-1"], ["content-1"]);

      expect(result.ok).toBe(true);
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
      const values = insertChain.values.mock.calls[0]?.[0] as Array<{ playoutItemId: string | null; contentId: string | null }>;
      expect(values).toHaveLength(2);
    });

    it("returns ok without inserting when both arrays are empty", async () => {
      const orchestrator = await setupModule();

      const result = await orchestrator.assignContent("channel-1", []);

      expect(result.ok).toBe(true);
      expect(mockDbInsert).not.toHaveBeenCalled();
    });
  });

  // ── removeContent ──

  describe("removeContent", () => {
    it("deletes channel_content entries for given playout item IDs", async () => {
      const orchestrator = await setupModule();

      const deleteChain = buildDeleteChain();
      mockDbDelete.mockReturnValue(deleteChain);

      const result = await orchestrator.removeContent("channel-1", ["item-1", "item-2"]);

      expect(result.ok).toBe(true);
      expect(mockDbDelete).toHaveBeenCalledTimes(1);
      expect(deleteChain.where).toHaveBeenCalled();
    });

    it("does not touch playout_queue entries", async () => {
      const orchestrator = await setupModule();

      const deleteChain = buildDeleteChain();
      mockDbDelete.mockReturnValue(deleteChain);

      await orchestrator.removeContent("channel-1", ["item-1"]);

      // Only one delete call — does not touch the queue
      expect(mockDbDelete).toHaveBeenCalledTimes(1);
    });

    it("deletes channel_content entries for given content IDs", async () => {
      const orchestrator = await setupModule();

      const deleteChain = buildDeleteChain();
      mockDbDelete.mockReturnValue(deleteChain);

      const result = await orchestrator.removeContent("channel-1", [], ["content-1"]);

      expect(result.ok).toBe(true);
      expect(mockDbDelete).toHaveBeenCalledTimes(1);
      expect(deleteChain.where).toHaveBeenCalled();
    });

    it("issues two delete calls when both playoutItemIds and contentIds are provided", async () => {
      const orchestrator = await setupModule();

      const deleteChain = buildDeleteChain();
      mockDbDelete.mockReturnValue(deleteChain);

      const result = await orchestrator.removeContent("channel-1", ["item-1"], ["content-1"]);

      expect(result.ok).toBe(true);
      expect(mockDbDelete).toHaveBeenCalledTimes(2);
    });

    it("does nothing when both arrays are empty", async () => {
      const orchestrator = await setupModule();

      const result = await orchestrator.removeContent("channel-1", []);

      expect(result.ok).toBe(true);
      expect(mockDbDelete).not.toHaveBeenCalled();
    });
  });

  // ── listContent ──

  describe("listContent", () => {
    it("returns content pool items with source type and metadata", async () => {
      const orchestrator = await setupModule();

      // listContent now uses db.execute() with raw SQL UNION
      mockDbExecute.mockResolvedValue([
        {
          id: "cc-1",
          channelId: "channel-1",
          playoutItemId: "item-1",
          contentId: null,
          sourceType: "playout",
          title: "Test Film",
          duration: 90.0,
          lastPlayedAt: null,
          playCount: 0,
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
        {
          id: "cc-2",
          channelId: "channel-1",
          playoutItemId: null,
          contentId: "content-1",
          sourceType: "content",
          title: "Creator Video",
          duration: 120.0,
          lastPlayedAt: null,
          playCount: 0,
          createdAt: new Date("2026-01-02T00:00:00Z"),
        },
      ]);

      const result = await orchestrator.listContent("channel-1");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
      expect(result.value[0]?.playoutItemId).toBe("item-1");
      expect(result.value[0]?.sourceType).toBe("playout");
      expect(result.value[0]?.title).toBe("Test Film");
      expect(result.value[1]?.contentId).toBe("content-1");
      expect(result.value[1]?.sourceType).toBe("content");
      expect(result.value[1]?.title).toBe("Creator Video");
    });
  });

  // ── insertIntoQueue ──

  describe("insertIntoQueue", () => {
    it("returns NotFoundError for nonexistent playout item", async () => {
      const orchestrator = await setupModule();

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]), // empty — item not found
        }),
      });

      const result = await orchestrator.insertIntoQueue(
        "channel-1",
        "nonexistent-item",
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("inserts at end when no position given", async () => {
      const orchestrator = await setupModule();

      // Select calls in order:
      // 1. Look up playout item → [item]
      // 2. Get max position → [{ max: 2 }]
      // 3. pushPrefetchBuffer unpushed → []
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([makeItemRow()]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ max: 2 }]),
          }),
        })
        .mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      const insertChain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            makeQueueRow({ position: 3 }),
          ]),
        }),
      };
      mockDbInsert.mockReturnValue(insertChain);

      const result = await orchestrator.insertIntoQueue("channel-1", "item-1");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const insertedValues = insertChain.values.mock.calls[0]?.[0] as { position: number };
      expect(insertedValues.position).toBe(3);
    });

    it("shifts existing entries when inserting at specific position", async () => {
      const orchestrator = await setupModule();

      // Select calls in order:
      // 1. Look up playout item → [item]
      // 2. pushPrefetchBuffer unpushed → []
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([makeItemRow()]),
          }),
        })
        .mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      const updateChain = buildUpdateChain();
      mockDbUpdate.mockReturnValue(updateChain);

      const insertChain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([makeQueueRow({ position: 2 })]),
        }),
      };
      mockDbInsert.mockReturnValue(insertChain);

      const result = await orchestrator.insertIntoQueue(
        "channel-1",
        "item-1",
        2,
      );

      expect(result.ok).toBe(true);
      // An update should have been called to shift positions
      expect(mockDbUpdate).toHaveBeenCalled();
    });
  });

  // ── removeFromQueue ──

  describe("removeFromQueue", () => {
    it("returns NotFoundError when entry does not exist", async () => {
      const orchestrator = await setupModule();

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await orchestrator.removeFromQueue("channel-1", "no-entry");

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("returns error when trying to remove playing entry", async () => {
      const orchestrator = await setupModule();

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([makeQueueRow({ status: "playing" })]),
        }),
      });

      const result = await orchestrator.removeFromQueue("channel-1", "entry-1");

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("CANNOT_REMOVE_PLAYING");
    });

    it("deletes queued entry successfully", async () => {
      const orchestrator = await setupModule();

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([makeQueueRow({ status: "queued" })]),
        }),
      });

      const deleteChain = buildDeleteChain();
      mockDbDelete.mockReturnValue(deleteChain);

      const result = await orchestrator.removeFromQueue("channel-1", "entry-1");

      expect(result.ok).toBe(true);
      expect(mockDbDelete).toHaveBeenCalled();
    });
  });

  // ── skip ──

  describe("skip", () => {
    it("marks playing entry as played and calls skipTrack on client", async () => {
      const orchestrator = await setupModule();

      // Select calls in order:
      // 1. Find playing entry → [playing row]
      // 2. Find next queued → []
      // 3. Queue depth check → 5 (at threshold, no auto-fill)
      // 4. pushPrefetchBuffer unpushed → []
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([makeQueueRow({ status: "playing" })]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 5 }]),
          }),
        })
        .mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      mockDbUpdate.mockReturnValue(buildUpdateChain());

      const result = await orchestrator.skip("channel-1");

      expect(result.ok).toBe(true);
      expect(mockSkipTrack).toHaveBeenCalledWith("channel-1");
    });

    it("advances next queued entry to playing", async () => {
      const orchestrator = await setupModule();

      const nextEntry = makeQueueRow({ id: "entry-2", position: 2, status: "queued" });

      // Select calls in order:
      // 1. Find playing entry
      // 2. Find next queued → nextEntry
      // 3. Queue depth → above threshold
      // 4. pushPrefetchBuffer unpushed → []
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([makeQueueRow({ status: "playing" })]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([nextEntry]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 8 }]),
          }),
        })
        .mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      const setFn = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      mockDbUpdate.mockReturnValue({ set: setFn });

      await orchestrator.skip("channel-1");

      // Two update calls: mark playing as played, then mark next as playing
      expect(mockDbUpdate).toHaveBeenCalledTimes(2);
    });
  });

  // ── onTrackStarted ──

  describe("onTrackStarted", () => {
    it("marks current playing entry as played", async () => {
      const orchestrator = await setupModule();

      const playingEntry = makeQueueRow({ status: "playing" });

      // Select calls in order:
      // 1. Find playing entry → [playingEntry]
      // 2. Find next queued → []
      // 3. Queue depth check → above threshold
      // 4. pushPrefetchBuffer unpushed → []
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([playingEntry]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 6 }]),
          }),
        })
        .mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      const setFn = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      mockDbUpdate.mockReturnValue({ set: setFn });

      const result = await orchestrator.onTrackStarted(
        "channel-1",
        "s3://snc-storage/playout/item-1/1080p.mp4",
      );

      expect(result.ok).toBe(true);
      // First update marks playing entry as played
      expect(setFn.mock.calls[0]?.[0]).toMatchObject({ status: "played" });
    });

    it("updates channel_content play stats when playing entry found", async () => {
      const orchestrator = await setupModule();

      const playingEntry = makeQueueRow({ status: "playing", playoutItemId: "item-1" });

      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([playingEntry]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 6 }]),
          }),
        })
        .mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      const setFn = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      mockDbUpdate.mockReturnValue({ set: setFn });

      await orchestrator.onTrackStarted(
        "channel-1",
        "s3://snc-storage/playout/item-1/1080p.mp4",
      );

      // Two updates: mark as played + update channel_content stats
      expect(mockDbUpdate).toHaveBeenCalledTimes(2);
      // Second update sets lastPlayedAt + increments playCount
      expect(setFn.mock.calls[1]?.[0]).toMatchObject({
        lastPlayedAt: expect.any(Date),
      });
    });

    it("triggers auto-fill when queue drops below threshold", async () => {
      const orchestrator = await setupModule();

      // Select calls in order:
      // 1. Find playing entry → none
      // 2. Find next queued → none
      // 3. Queue depth check → below threshold (2)
      // 4. autoFill: depth check (in autoFill fn) → also low
      // 5. autoFill: max position query
      // 6. pushPrefetchBuffer unpushed → []
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 2 }]),
          }),
        })
        .mockReturnValueOnce({
          // autoFill depth check
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 2 }]),
          }),
        })
        .mockReturnValue({
          // pushPrefetchBuffer
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      mockDbUpdate.mockReturnValue(buildUpdateChain());
      mockDbExecute.mockResolvedValue([]);

      const result = await orchestrator.onTrackStarted(
        "channel-1",
        "s3://snc-storage/playout/item-1/1080p.mp4",
      );

      expect(result.ok).toBe(true);
      // autoFill ran the SQL execute query
      expect(mockDbExecute).toHaveBeenCalled();
    });
  });

  // ── initialize ──

  describe("initialize", () => {
    it("does nothing when no active playout channels exist", async () => {
      const orchestrator = await setupModule();

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      // Should not throw
      await expect(orchestrator.initialize()).resolves.toBeUndefined();
    });

    it("calls autoFill for each active channel when queue is empty", async () => {
      const orchestrator = await setupModule();

      // Queue all select responses in order:
      // 1. channels query → one channel
      // 2. autoFill depth check → count 0 (below threshold)
      // 3. autoFill max position query → max null
      // 4. pushPrefetchBuffer unpushed entries → empty
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([makeChannelRow()]),
          }),
        })
        .mockReturnValueOnce({
          // autoFill: depth check
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          // autoFill: max position (no rows yet)
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ max: null }]),
          }),
        })
        .mockReturnValue({
          // pushPrefetchBuffer: unpushed entries
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      // autoFill SQL query returns no candidates
      mockDbExecute.mockResolvedValue([]);

      await orchestrator.initialize();

      // autoFill ran the SQL execute query
      expect(mockDbExecute).toHaveBeenCalled();
    });
  });

  // ── autoFill ──

  describe("autoFill", () => {
    it("does nothing when pool is empty", async () => {
      const orchestrator = await setupModule();

      // Queue depth check — below threshold
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      // SQL query returns no candidates
      mockDbExecute.mockResolvedValue([]);

      await orchestrator.autoFill("channel-1");

      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it("does nothing when queue is above threshold", async () => {
      const orchestrator = await setupModule();

      // Queue depth check — above threshold (5+)
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      });

      await orchestrator.autoFill("channel-1");

      expect(mockDbExecute).not.toHaveBeenCalled();
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it("inserts candidates from playout items and creator content into queue", async () => {
      const orchestrator = await setupModule();

      let selectCallCount = 0;
      mockDbSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Queue depth — below threshold
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 2 }]),
            }),
          };
        }
        // Max position query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ max: 1 }]),
          }),
        };
      });

      mockDbExecute.mockResolvedValue([
        { playout_item_id: "item-1" },
        { playout_item_id: "item-2" },
      ]);

      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDbInsert.mockReturnValue(insertChain);

      await orchestrator.autoFill("channel-1");

      expect(mockDbInsert).toHaveBeenCalled();
      const inserted = insertChain.values.mock.calls[0]?.[0] as Array<{
        playoutItemId: string;
        position: number;
      }>;
      expect(inserted).toHaveLength(2);
      expect(inserted[0]?.playoutItemId).toBe("item-1");
      expect(inserted[1]?.playoutItemId).toBe("item-2");
      // Positions should be sequential starting from max+1
      expect(inserted[0]?.position).toBe(2);
      expect(inserted[1]?.position).toBe(3);
    });
  });

  // ── searchAvailableContent ──

  describe("searchAvailableContent", () => {
    it("returns mixed playout and creator content results", async () => {
      const orchestrator = await setupModule();

      mockDbExecute.mockResolvedValue([
        {
          id: "item-1",
          sourceType: "playout",
          title: "Test Film",
          duration: 90.0,
          creator: null,
        },
        {
          id: "content-1",
          sourceType: "content",
          title: "Creator Video",
          duration: 120.0,
          creator: "Jane Doe",
        },
      ]);

      const result = await orchestrator.searchAvailableContent("channel-1", "test");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
      expect(result.value[0]).toMatchObject({
        id: "item-1",
        sourceType: "playout",
        title: "Test Film",
        creator: null,
      });
      expect(result.value[1]).toMatchObject({
        id: "content-1",
        sourceType: "content",
        title: "Creator Video",
        creator: "Jane Doe",
      });
    });

    it("returns empty array when no matches found", async () => {
      const orchestrator = await setupModule();

      mockDbExecute.mockResolvedValue([]);

      const result = await orchestrator.searchAvailableContent("channel-1", "no-match");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(0);
    });

    it("uses db.execute for the UNION query", async () => {
      const orchestrator = await setupModule();

      mockDbExecute.mockResolvedValue([]);

      await orchestrator.searchAvailableContent("channel-1", "query");

      expect(mockDbExecute).toHaveBeenCalled();
    });
  });
});
