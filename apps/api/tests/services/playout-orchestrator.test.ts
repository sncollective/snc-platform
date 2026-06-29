import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import type { LiquidsoapClient } from "../../src/services/liquidsoap-client.js";

// ── Mock Liquidsoap Client ──

const mockPushTrack = vi.fn();
const mockSkipTrack = vi.fn();
const mockGetNowPlaying = vi.fn();
const mockArmQueue = vi.fn().mockResolvedValue({ ok: true, value: undefined });

const mockLiquidsoapClient: LiquidsoapClient = {
  pushTrack: mockPushTrack,
  skipTrack: mockSkipTrack,
  getNowPlaying: mockGetNowPlaying,
  armQueue: mockArmQueue,
};

// ── Mock DB State ──

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();
const mockDbExecute = vi.fn();

// ── Mock Channel Lookup (used by publishCreatorEditorialChange inside transitions) ──

const mockFindChannelCreatorId = vi.fn<(channelId: string) => Promise<string | null>>();

// ── Fixtures ──

const makeChannelRow = (overrides: Record<string, unknown> = {}) => ({
  id: "channel-1",
  name: "S/NC Classics",
  ownership: "platform",
  role: "playout",
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

const setupModule = async (configOverrides: Record<string, unknown> = {}) => {
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
    playoutQueue: { id: {}, channelId: {}, playoutItemId: {}, contentId: {}, position: {}, status: {}, pushedToLiquidsoap: {}, createdAt: {} },
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
    channels: {
      id: {},
      name: {},
      type: {},
      isActive: {},
      role: {},
      ownership: {},
      creatorId: {},
    },
  }));

  vi.doMock("../../src/config.js", () => ({
    config: {
      S3_BUCKET: "snc-storage",
      AUTH_RATE_LIMIT_PROFILE: "strict",
      ...configOverrides,
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

  // Stub out the channel lookup used by publishCreatorEditorialChange so it does
  // not reach the DB mock. Default: platform channel (null → no creator emit).
  vi.doMock("../../src/services/channels.js", () => ({
    findChannelCreatorId: mockFindChannelCreatorId,
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
    // Default: platform channel — publishCreatorEditorialChange no-ops (no creator emit).
    mockFindChannelCreatorId.mockResolvedValue(null);
  });

  // ── assignContent ──

  describe("assignContent", () => {
    // These exercise the platform/admin path (channel-1 is platform-owned), where
    // playout items are assignable and no ownership-validation query runs. The
    // resolvePoolScope SELECT must return a platform row — a missing row now fails
    // closed (round-2), so the scope mock is required, not optional.
    const platformScopeRow = [{ ownership: "platform", creatorId: null }];

    it("inserts channel_content entries for given playout item IDs", async () => {
      const orchestrator = await setupModule();

      mockDbExecute.mockResolvedValue(platformScopeRow);

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

      mockDbExecute.mockResolvedValue(platformScopeRow);

      const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({ onConflictDoNothing }),
      });

      await orchestrator.assignContent("channel-1", ["item-1"]);

      expect(onConflictDoNothing).toHaveBeenCalled();
    });

    it("inserts channel_content entries for given content IDs", async () => {
      const orchestrator = await setupModule();

      mockDbExecute.mockResolvedValue(platformScopeRow);

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

      mockDbExecute.mockResolvedValue(platformScopeRow);

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

      mockDbExecute.mockResolvedValue(platformScopeRow);

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
    /** A platform-owned channel row, as returned by the resolvePoolScope SELECT. */
    const platformScopeRow = [{ ownership: "platform", creatorId: null }];

    it("returns NotFoundError for nonexistent playout item", async () => {
      const orchestrator = await setupModule();

      // resolvePoolScope → platform/admin (no pool-membership gate; admin path).
      mockDbExecute.mockResolvedValue(platformScopeRow);

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]), // empty — item not found
        }),
      });

      const result = await orchestrator.insertIntoQueue("channel-1", {
        playoutItemId: "nonexistent-item",
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("NOT_FOUND");
    });

    it("inserts at end when no position given", async () => {
      const orchestrator = await setupModule();

      // resolvePoolScope → platform/admin (admin path, unchanged behavior).
      mockDbExecute.mockResolvedValue(platformScopeRow);

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

      const result = await orchestrator.insertIntoQueue("channel-1", {
        playoutItemId: "item-1",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const insertedValues = insertChain.values.mock.calls[0]?.[0] as { position: number };
      expect(insertedValues.position).toBe(3);
    });

    it("shifts existing entries when inserting at specific position", async () => {
      const orchestrator = await setupModule();

      // resolvePoolScope → platform/admin (admin path, unchanged behavior).
      mockDbExecute.mockResolvedValue(platformScopeRow);

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
        { playoutItemId: "item-1" },
        2,
      );

      expect(result.ok).toBe(true);
      // An update should have been called to shift positions
      expect(mockDbUpdate).toHaveBeenCalled();
    });
  });

  // ── getChannelQueueStatus (read coalescing) ──
  //
  // The reads LEFT JOIN both playout_items and content and coalesce title/duration +
  // derive sourceType. An INNER JOIN against playout_items would drop content rows
  // (the read bug this fixes). The DB layer evaluates the coalesce/CASE, so the mock
  // returns the already-coalesced row shape; the assertions prove toQueueEntry carries
  // contentId + sourceType through for BOTH a playout row and a content row.

  describe("getChannelQueueStatus", () => {
    it("surfaces both playout and content rows with sourceType + coalesced title/duration", async () => {
      const orchestrator = await setupModule();

      // 1. channel lookup → one row
      // 2. queue rows via leftJoin/leftJoin chain → a playout row AND a content row
      // 3. pool-count select → [{ count }]
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([makeChannelRow()]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue([
                    {
                      id: "q-playout",
                      channelId: "channel-1",
                      playoutItemId: "item-1",
                      contentId: null,
                      position: 1,
                      status: "playing",
                      pushedToLiquidsoap: true,
                      createdAt: new Date("2026-01-01T00:00:00Z"),
                      sourceType: "playout",
                      title: "Library Film",
                      duration: 90.0,
                    },
                    {
                      id: "q-content",
                      channelId: "channel-1",
                      playoutItemId: null,
                      contentId: "content-1",
                      position: 2,
                      status: "queued",
                      pushedToLiquidsoap: false,
                      createdAt: new Date("2026-01-02T00:00:00Z"),
                      sourceType: "content",
                      title: "Creator Video",
                      duration: 120.0,
                    },
                  ]),
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 2 }]),
          }),
        });

      const result = await orchestrator.getChannelQueueStatus("channel-1");

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // The playout row is now-playing, carrying its playout source.
      expect(result.value.nowPlaying?.playoutItemId).toBe("item-1");
      expect(result.value.nowPlaying?.contentId).toBeNull();
      expect(result.value.nowPlaying?.sourceType).toBe("playout");
      expect(result.value.nowPlaying?.title).toBe("Library Film");

      // The content row is NOT dropped (the INNER-JOIN bug) — it appears in upcoming
      // with its content source + coalesced title/duration.
      expect(result.value.upcoming).toHaveLength(1);
      expect(result.value.upcoming[0]?.contentId).toBe("content-1");
      expect(result.value.upcoming[0]?.playoutItemId).toBeNull();
      expect(result.value.upcoming[0]?.sourceType).toBe("content");
      expect(result.value.upcoming[0]?.title).toBe("Creator Video");
      expect(result.value.upcoming[0]?.duration).toBe(120.0);
    });
  });

  // ── insertIntoQueue with a content source ──

  describe("insertIntoQueue — content source", () => {
    const CREATOR_ID = "creator-A";
    const creatorChannelScopeRow = [{ ownership: "creator", creatorId: CREATOR_ID }];

    it("queues a creator's own pooled content (matched on content_id) and returns a content entry", async () => {
      const orchestrator = await setupModule();

      // db.execute: 1. resolvePoolScope → creator-owned; 2. pool-membership SELECT 1
      //   keyed on content_id → one row (the content IS in this channel's pool).
      mockDbExecute
        .mockResolvedValueOnce(creatorChannelScopeRow)
        .mockResolvedValueOnce([{ "?column?": 1 }]);

      // db.select: 1. content existence lookup → [content row]; 2. enqueue max-position
      //   → [{ max: 0 }]; 3. pushPrefetchBuffer unpushed → [].
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "content-1", title: "Creator Video", duration: 120.0 },
            ]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ max: 0 }]),
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
            {
              id: "entry-content",
              channelId: "creator-channel-A",
              playoutItemId: null,
              contentId: "content-1",
              position: 1,
              status: "queued",
              pushedToLiquidsoap: false,
              createdAt: new Date("2026-01-01T00:00:00Z"),
            },
          ]),
        }),
      };
      mockDbInsert.mockReturnValue(insertChain);

      const result = await orchestrator.insertIntoQueue("creator-channel-A", {
        contentId: "content-1",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // The returned entry is a content source — contentId set, playoutItemId null.
      expect(result.value.contentId).toBe("content-1");
      expect(result.value.playoutItemId).toBeNull();
      expect(result.value.sourceType).toBe("content");
      expect(result.value.title).toBe("Creator Video");
      // The insert wrote content_id, never playout_item_id (the one-source CHECK).
      const inserted = insertChain.values.mock.calls[0]?.[0] as {
        contentId?: string;
        playoutItemId?: string;
      };
      expect(inserted.contentId).toBe("content-1");
      expect(inserted.playoutItemId).toBeUndefined();
      // The pool-membership query keyed on content_id (not playout_item_id).
      const poolSql = mockDbExecute.mock.calls[1]?.[0] as { queryChunks?: unknown };
      expect(JSON.stringify(poolSql)).toContain("content_id");
    });

    it("rejects a contentId NOT in the creator channel's pool with ForbiddenError", async () => {
      const orchestrator = await setupModule();

      // resolvePoolScope → creator; pool-membership SELECT 1 (content_id) → empty.
      mockDbExecute
        .mockResolvedValueOnce(creatorChannelScopeRow)
        .mockResolvedValueOnce([]);

      // Content exists globally — only the pool gate should reject, not existence.
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "foreign-content", title: "Other", duration: 10 },
          ]),
        }),
      });

      const insertChain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([makeQueueRow()]),
        }),
      };
      mockDbInsert.mockReturnValue(insertChain);

      const result = await orchestrator.insertIntoQueue("creator-channel-A", {
        contentId: "foreign-content",
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("FORBIDDEN");
      expect(result.error.statusCode).toBe(403);
      // Nothing enqueued — the pool gate rejected before the insert.
      expect(mockDbInsert).not.toHaveBeenCalled();
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

    it("default startup ignores creator live-ingest channels even if the DB returns them", async () => {
      const orchestrator = await setupModule();

      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              makeChannelRow({ id: "playout-channel", role: "playout", ownership: "platform" }),
              makeChannelRow({
                id: "creator-channel",
                role: "live-ingest",
                ownership: "creator",
                creatorId: "creator-1",
              }),
            ]),
          }),
        })
        .mockReturnValueOnce({
          // autoFill: playout channel is already at threshold.
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 5 }]),
          }),
        })
        .mockReturnValueOnce({
          // pushPrefetchBuffer: only the playout channel is visited.
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        });

      mockDbUpdate.mockReturnValueOnce(buildUpdateChain());

      await orchestrator.initialize();

      expect(mockDbSelect).toHaveBeenCalledTimes(3);
      expect(mockPushTrack).not.toHaveBeenCalled();
    });

    it("e2e startup prefetches queued creator live-ingest content", async () => {
      const orchestrator = await setupModule({ TEST_CONTROL_PROFILE: "e2e" });

      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              makeChannelRow({
                id: "creator-channel",
                role: "live-ingest",
                ownership: "creator",
                creatorId: "creator-1",
              }),
            ]),
          }),
        })
        .mockReturnValueOnce({
          // autoFill: existing queue is already deep enough; preserve queued content.
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 5 }]),
          }),
        })
        .mockReturnValueOnce({
          // pushPrefetchBuffer: one queued creator-content row needs pushing.
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  makeQueueRow({
                    id: "queue-content-1",
                    channelId: "creator-channel",
                    playoutItemId: null,
                    contentId: "content-1",
                  }),
                ]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // resolveContentUri: content lookup.
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: "content-1",
                mediaKey: "creators/creator-1/content-1/source.mp4",
                transcodedMediaKey: "creators/creator-1/content-1/720p.mp4",
              },
            ]),
          }),
        });

      mockDbUpdate
        .mockReturnValueOnce(buildUpdateChain())
        .mockReturnValueOnce(buildUpdateChain());

      await orchestrator.initialize();

      expect(mockPushTrack).toHaveBeenCalledWith(
        "creator-channel",
        "s3://snc-storage/creators/creator-1/content-1/720p.mp4",
      );
      expect(mockDbUpdate).toHaveBeenCalledTimes(2);
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

      // initialize() resets pushedToLiquidsoap for all active queue items
      // before looping channels: db.update(playoutQueue).set(...).where(...)
      // Landed in commit 85d2b0b (2026-04-09) — test mock was never updated.
      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
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

      // Candidate rows now carry their REAL source type + id (a content row's id is
      // NOT aliased into playout_item_id — the FK-violation fix). Auto-fill must map
      // each to the correct QueueSource column so the one-source CHECK holds.
      mockDbExecute.mockResolvedValue([
        { source_type: "playout", source_id: "item-1" },
        { source_type: "content", source_id: "content-1" },
      ]);

      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDbInsert.mockReturnValue(insertChain);

      await orchestrator.autoFill("channel-1");

      expect(mockDbInsert).toHaveBeenCalled();
      const inserted = insertChain.values.mock.calls[0]?.[0] as Array<{
        playoutItemId?: string;
        contentId?: string;
        position: number;
      }>;
      expect(inserted).toHaveLength(2);
      // Playout source → writes playout_item_id, no content_id.
      expect(inserted[0]?.playoutItemId).toBe("item-1");
      expect(inserted[0]?.contentId).toBeUndefined();
      // Content source → writes content_id, no playout_item_id (the FK-fix: a
      // content.id never lands in the playout_item_id FK column).
      expect(inserted[1]?.contentId).toBe("content-1");
      expect(inserted[1]?.playoutItemId).toBeUndefined();
      // Positions should be sequential starting from max+1
      expect(inserted[0]?.position).toBe(2);
      expect(inserted[1]?.position).toBe(3);
    });
  });

  // ── searchAvailableContent ──

  describe("searchAvailableContent", () => {
    /** A platform-owned channel row, as returned by the resolvePoolScope SELECT. */
    const platformScopeRow = [{ ownership: "platform", creatorId: null }];

    it("returns mixed playout and creator content results", async () => {
      const orchestrator = await setupModule();

      // db.execute: 1. resolvePoolScope → platform/admin; 2. the search UNION.
      mockDbExecute
        .mockResolvedValueOnce(platformScopeRow)
        .mockResolvedValueOnce([
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

      // db.execute: 1. resolvePoolScope → platform/admin; 2. the search UNION → none.
      mockDbExecute
        .mockResolvedValueOnce(platformScopeRow)
        .mockResolvedValueOnce([]);

      const result = await orchestrator.searchAvailableContent("channel-1", "no-match");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(0);
    });

    it("uses db.execute for the UNION query", async () => {
      const orchestrator = await setupModule();

      mockDbExecute
        .mockResolvedValueOnce(platformScopeRow)
        .mockResolvedValueOnce([]);

      await orchestrator.searchAvailableContent("channel-1", "query");

      expect(mockDbExecute).toHaveBeenCalled();
    });
  });

  // ── Cross-creator content scope (security regression guard) ──
  //
  // These prove the blocker fix: the shared editorial content methods derive their
  // pool scope from the channel's ownership row, not the caller. A creator-owned
  // channel constrains search to its own non-deleted content and rejects assigning
  // any content it does not own (or any platform playout item). A platform/admin
  // channel keeps the prior unconstrained behavior.
  //
  // Against the OLD (unscoped) code these tests fail: the old searchAvailableContent
  // ran the same UNION for every channel (so a creator would see other creators'
  // rows), and the old assignContent inserted any caller-supplied contentId with no
  // ownership check (so the cross-creator assignment returned ok).

  describe("content pool scope (creator vs admin)", () => {
    const CREATOR_ID = "creator-A";

    /** A creator-owned channel row, as returned by the resolvePoolScope SELECT. */
    const creatorChannelScopeRow = [{ ownership: "creator", creatorId: CREATOR_ID }];
    /** A platform-owned channel row → allCreators scope. */
    const platformChannelScopeRow = [{ ownership: "platform", creatorId: null }];

    describe("searchAvailableContent — creator scope", () => {
      it("only emits the creator's own content (no playout branch, no cross-creator rows)", async () => {
        const orchestrator = await setupModule();

        // Call 1: resolvePoolScope channel lookup → creator-owned.
        // Call 2: the scoped search query. The orchestrator builds the SQL with the
        // creator filter embedded; the DB layer returns only that creator's rows.
        mockDbExecute
          .mockResolvedValueOnce(creatorChannelScopeRow)
          .mockResolvedValueOnce([
            {
              id: "content-A1",
              sourceType: "content",
              title: "My Own Film",
              duration: 90,
              creator: "Creator A",
            },
          ]);

        const result = await orchestrator.searchAvailableContent(
          "creator-channel-A",
          "film",
        );

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // Only the creator's own content surfaced.
        expect(result.value).toHaveLength(1);
        expect(result.value[0]?.id).toBe("content-A1");
        // No other creator's content leaked into the result.
        expect(result.value.some((r) => r.id === "content-B1")).toBe(false);
        // No playout branch for a creator (content-only pool).
        expect(result.value.some((r) => r.sourceType === "playout")).toBe(false);

        // The scoped search SQL carries the creator_id constraint and excludes the
        // playout_items branch — assert against the rendered query string.
        const searchSql = mockDbExecute.mock.calls[1]?.[0] as { queryChunks?: unknown };
        const rendered = JSON.stringify(searchSql);
        expect(rendered).toContain("c.creator_id");
        expect(rendered).toContain("deleted_at");
        // The creator id is bound as a parameter on the search call.
        expect(rendered).toContain(CREATOR_ID);
        // No playout_items table in the creator-scoped query.
        expect(rendered).not.toContain("playout_items");
      });
    });

    describe("searchAvailableContent — admin scope (unchanged)", () => {
      it("does NOT add a creator_id constraint and keeps the playout branch", async () => {
        const orchestrator = await setupModule();

        mockDbExecute
          .mockResolvedValueOnce(platformChannelScopeRow)
          .mockResolvedValueOnce([]);

        const result = await orchestrator.searchAvailableContent("admin-channel", "x");

        expect(result.ok).toBe(true);
        const searchSql = mockDbExecute.mock.calls[1]?.[0] as { queryChunks?: unknown };
        const rendered = JSON.stringify(searchSql);
        // Admin path keeps both branches and adds no creator constraint.
        expect(rendered).toContain("playout_items");
        expect(rendered).not.toContain("c.creator_id =");
      });
    });

    describe("assignContent — creator scope", () => {
      it("rejects assigning another creator's content id with ForbiddenError and inserts nothing", async () => {
        const orchestrator = await setupModule();

        // Call 1: resolvePoolScope → creator-owned (uses db.execute).
        mockDbExecute.mockResolvedValueOnce(creatorChannelScopeRow);

        // Call 2: ownership validation uses db.select().from().where() →
        // returns only content-A1; content-B1 (another creator's) is absent.
        mockDbSelect.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "content-A1" }]),
          }),
        });

        const insertChain = {
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          }),
        };
        mockDbInsert.mockReturnValue(insertChain);

        const result = await orchestrator.assignContent(
          "creator-channel-A",
          [],
          ["content-A1", "content-B1"],
        );

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe("FORBIDDEN");
        expect(result.error.statusCode).toBe(403);
        // Nothing was written when the request contained an unowned id.
        expect(mockDbInsert).not.toHaveBeenCalled();
      });

      it("rejects assigning a platform playout item to a creator pool (content-only)", async () => {
        const orchestrator = await setupModule();

        // Only the scope lookup runs — the playout-item guard short-circuits before
        // any ownership validation query.
        mockDbExecute.mockResolvedValueOnce(creatorChannelScopeRow);

        mockDbInsert.mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const result = await orchestrator.assignContent(
          "creator-channel-A",
          ["platform-item-1"],
          [],
        );

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe("FORBIDDEN");
        expect(mockDbInsert).not.toHaveBeenCalled();
      });

      it("allows assigning the creator's own content id (inserts the pool entry)", async () => {
        const orchestrator = await setupModule();

        // Call 1: resolvePoolScope → creator-owned (uses db.execute).
        mockDbExecute.mockResolvedValueOnce(creatorChannelScopeRow);

        // Call 2: ownership validation uses db.select().from().where() →
        // returns content-A1, confirming it is owned by the channel's creator.
        mockDbSelect.mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "content-A1" }]),
          }),
        });

        const insertChain = {
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          }),
        };
        mockDbInsert.mockReturnValue(insertChain);

        const result = await orchestrator.assignContent(
          "creator-channel-A",
          [],
          ["content-A1"],
        );

        expect(result.ok).toBe(true);
        expect(mockDbInsert).toHaveBeenCalledTimes(1);
        const values = insertChain.values.mock.calls[0]?.[0] as Array<{ contentId: string }>;
        expect(values).toHaveLength(1);
        expect(values[0]?.contentId).toBe("content-A1");
      });
    });

    describe("assignContent — admin scope (unchanged)", () => {
      it("inserts caller-supplied content ids without an ownership check", async () => {
        const orchestrator = await setupModule();

        // Scope lookup → platform/admin. No ownership-validation query is issued.
        mockDbExecute.mockResolvedValueOnce(platformChannelScopeRow);

        const insertChain = {
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          }),
        };
        mockDbInsert.mockReturnValue(insertChain);

        const result = await orchestrator.assignContent(
          "admin-channel",
          ["item-1"],
          ["content-from-any-creator"],
        );

        expect(result.ok).toBe(true);
        // Admin path inserts both the playout item and the content id, unchanged.
        expect(mockDbInsert).toHaveBeenCalledTimes(1);
        const values = insertChain.values.mock.calls[0]?.[0] as Array<{
          playoutItemId: string | null;
          contentId: string | null;
        }>;
        expect(values).toHaveLength(2);
        // Only the scope lookup ran on db.execute — no ownership validation query.
        expect(mockDbExecute).toHaveBeenCalledTimes(1);
      });
    });

    // ── insertIntoQueue scope (round-2 blocker) ──
    //
    // The creator queue-insert path is the second cross-tenant entry point: a
    // creator owner who knows ANY platform/other-creator playoutItemId could queue
    // and play it directly, bypassing the now-scoped content pool. The fix makes the
    // creator-scoped pool the single chokepoint — a creator may only queue an item
    // already in THIS channel's channel_content pool. Admin channels are unchanged
    // (they legitimately queue from the full library).
    //
    // Against the OLD (unscoped) insertIntoQueue these creator tests fail: the old
    // method validated only that the playout_items row existed, with no pool check,
    // so a foreign playoutItemId was enqueued and returned ok.

    describe("insertIntoQueue — creator scope", () => {
      it("rejects a playoutItemId NOT in the channel's pool with ForbiddenError and enqueues nothing", async () => {
        const orchestrator = await setupModule();

        // db.execute calls in order:
        // 1. resolvePoolScope → creator-owned.
        // 2. pool-membership SELECT 1 → empty (item not in this channel's pool).
        mockDbExecute
          .mockResolvedValueOnce(creatorChannelScopeRow)
          .mockResolvedValueOnce([]);

        // The item DOES exist globally — so a leak would only be caught by the pool
        // check, not the existence check. Wire the item lookup to succeed to prove
        // the pool gate (not the existence gate) is what rejects.
        mockDbSelect.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([makeItemRow({ id: "foreign-item" })]),
          }),
        });

        const insertChain = {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([makeQueueRow()]),
          }),
        };
        mockDbInsert.mockReturnValue(insertChain);

        const result = await orchestrator.insertIntoQueue("creator-channel-A", {
          playoutItemId: "foreign-item",
        });

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe("FORBIDDEN");
        expect(result.error.statusCode).toBe(403);
        // Nothing was enqueued — the queue insert never ran.
        expect(mockDbInsert).not.toHaveBeenCalled();
        // The pool-membership query carried this channel + playout item.
        const poolSql = mockDbExecute.mock.calls[1]?.[0] as { queryChunks?: unknown };
        const rendered = JSON.stringify(poolSql);
        expect(rendered).toContain("channel_content");
        expect(rendered).toContain("creator-channel-A");
        expect(rendered).toContain("foreign-item");
      });

      it("allows a playoutItemId that IS in the channel's scoped pool (enqueues it)", async () => {
        const orchestrator = await setupModule();

        // db.execute calls in order:
        // 1. resolvePoolScope → creator-owned.
        // 2. pool-membership SELECT 1 → one row (item is in this channel's pool).
        mockDbExecute
          .mockResolvedValueOnce(creatorChannelScopeRow)
          .mockResolvedValueOnce([{ "?column?": 1 }]);

        // mockDbSelect serves, in order: item lookup → [item]; enqueue max-position
        // → [{ max: 0 }]; pushPrefetchBuffer unpushed → [].
        mockDbSelect
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([makeItemRow({ id: "pooled-item" })]),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ max: 0 }]),
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
              makeQueueRow({ playoutItemId: "pooled-item", position: 1 }),
            ]),
          }),
        };
        mockDbInsert.mockReturnValue(insertChain);

        const result = await orchestrator.insertIntoQueue("creator-channel-A", {
          playoutItemId: "pooled-item",
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.playoutItemId).toBe("pooled-item");
        // The pooled item was actually enqueued.
        expect(mockDbInsert).toHaveBeenCalledTimes(1);
      });
    });

    describe("insertIntoQueue — admin scope (unchanged)", () => {
      it("enqueues any existing playout item without a pool-membership check", async () => {
        const orchestrator = await setupModule();

        // db.execute → platform/admin scope only. NO pool-membership query is issued
        // on the admin path (admins queue from the full library).
        mockDbExecute.mockResolvedValueOnce(platformChannelScopeRow);

        mockDbSelect
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([makeItemRow({ id: "any-item" })]),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ max: 0 }]),
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
              makeQueueRow({ playoutItemId: "any-item", position: 1 }),
            ]),
          }),
        };
        mockDbInsert.mockReturnValue(insertChain);

        const result = await orchestrator.insertIntoQueue("admin-channel", {
          playoutItemId: "any-item",
        });

        expect(result.ok).toBe(true);
        expect(mockDbInsert).toHaveBeenCalledTimes(1);
        // Only the scope lookup ran on db.execute — no pool-membership query.
        expect(mockDbExecute).toHaveBeenCalledTimes(1);
      });
    });

    // ── resolvePoolScope fail-closed (round-2 important) ──
    //
    // A missing / raced / bogus channelId must NEVER resolve to the most-permissive
    // admin-wide scope. resolvePoolScope returns NotFoundError when the channel row
    // is absent, and the methods that call it short-circuit on that error — so no
    // cross-creator data is reachable through a phantom channel.
    //
    // Against the OLD (fail-open) code these tests fail: a missing channel row
    // yielded { allCreators: true }, so searchAvailableContent ran the unconstrained
    // admin UNION, assignContent inserted unchecked, and insertIntoQueue skipped the
    // pool gate — all returning ok against a channel that does not exist.

    describe("missing channel row fails closed (never admin scope)", () => {
      it("searchAvailableContent returns NotFoundError and runs no content query", async () => {
        const orchestrator = await setupModule();

        // resolvePoolScope channel lookup → no row.
        mockDbExecute.mockResolvedValueOnce([]);

        const result = await orchestrator.searchAvailableContent(
          "missing-channel",
          "film",
        );

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe("NOT_FOUND");
        expect(result.error.statusCode).toBe(404);
        // Only the scope lookup ran — the content UNION query never executed, so no
        // cross-creator rows could be returned.
        expect(mockDbExecute).toHaveBeenCalledTimes(1);
      });

      it("assignContent returns NotFoundError and inserts nothing", async () => {
        const orchestrator = await setupModule();

        mockDbExecute.mockResolvedValueOnce([]);

        const insertChain = {
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          }),
        };
        mockDbInsert.mockReturnValue(insertChain);

        const result = await orchestrator.assignContent(
          "missing-channel",
          [],
          ["content-from-any-creator"],
        );

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe("NOT_FOUND");
        // Nothing was written for a phantom channel.
        expect(mockDbInsert).not.toHaveBeenCalled();
        // Only the scope lookup ran — no ownership-validation query.
        expect(mockDbExecute).toHaveBeenCalledTimes(1);
      });

      it("insertIntoQueue returns NotFoundError and enqueues nothing", async () => {
        const orchestrator = await setupModule();

        mockDbExecute.mockResolvedValueOnce([]);

        const insertChain = {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([makeQueueRow()]),
          }),
        };
        mockDbInsert.mockReturnValue(insertChain);

        const result = await orchestrator.insertIntoQueue("missing-channel", {
          playoutItemId: "item-1",
        });

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe("NOT_FOUND");
        // Nothing was enqueued for a phantom channel.
        expect(mockDbInsert).not.toHaveBeenCalled();
        // Only the scope lookup ran — no pool-membership query, no item lookup.
        expect(mockDbExecute).toHaveBeenCalledTimes(1);
      });
    });
  });
});
