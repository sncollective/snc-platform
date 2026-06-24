import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// ── Mock DB State ──

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();

// ── Mock Event Bus ──

const mockPublish = vi.fn();
const mockEventBus = { publish: mockPublish };

// ── Mock Channel Lookup ──

const mockFindChannelCreatorId = vi.fn<(channelId: string) => Promise<string | null>>();

// ── Setup ──

const setupModule = async () => {
  vi.doMock("../../src/db/connection.js", () => ({
    db: {
      select: mockDbSelect,
      insert: mockDbInsert,
      update: mockDbUpdate,
      delete: mockDbDelete,
    },
  }));

  vi.doMock("../../src/db/schema/playout-queue.schema.js", () => ({
    playoutQueue: {
      id: {},
      channelId: {},
      playoutItemId: {},
      contentId: {},
      position: {},
      status: {},
      pushedToLiquidsoap: {},
      createdAt: {},
    },
  }));

  vi.doMock("../../src/services/event-bus.js", () => ({
    eventBus: mockEventBus,
  }));

  vi.doMock("../../src/services/channels.js", () => ({
    findChannelCreatorId: mockFindChannelCreatorId,
  }));

  const mod = await import("../../src/services/playout-queue-transitions.js");
  return mod;
};

// ── Fixtures ──

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

// ── DB chain builders (drizzle-chainable-mock pattern) ──

const buildUpdateChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  }),
});

const buildSelectChainResolvingWith = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
      // for simple .where().mockResolvedValue pattern (MAX query)
    }),
  }),
});

const buildSimpleSelectChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(rows),
  }),
});

const buildInsertChain = (rows: unknown[]) => ({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(rows),
  }),
});

const buildInsertChainNoReturn = () => ({
  values: vi.fn().mockResolvedValue(undefined),
});

const buildDeleteChain = () => ({
  where: vi.fn().mockResolvedValue([]),
});

// ── Tests ──

describe("playout-queue-transitions", () => {
  beforeEach(() => {
    // Default to platform channel so existing tests that don't care about
    // creator emit don't need to set up the mock explicitly.
    mockFindChannelCreatorId.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  // Override per-test for creator-channel scenarios.
  const setupCreatorChannel = (creatorId = "creator-abc") => {
    mockFindChannelCreatorId.mockResolvedValue(creatorId);
  };

  // ── markPlayed ──

  describe("markPlayed", () => {
    it("issues an UPDATE setting status to 'played' for the given entry id", async () => {
      const { markPlayed } = await setupModule();

      const updateChain = buildUpdateChain();
      mockDbUpdate.mockReturnValue(updateChain);

      await markPlayed("entry-1", "channel-1");

      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
      expect(updateChain.set).toHaveBeenCalledTimes(1);
      const setArg = updateChain.set.mock.calls[0]?.[0] as { status: string };
      expect(setArg).toMatchObject({ status: "played" });
      expect(updateChain.set.mock.results[0]?.value.where).toHaveBeenCalledTimes(1);
    });

    it("does not issue any selects or inserts", async () => {
      const { markPlayed } = await setupModule();

      mockDbUpdate.mockReturnValue(buildUpdateChain());

      await markPlayed("entry-1", "channel-1");

      expect(mockDbSelect).not.toHaveBeenCalled();
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it("publishes playout.now-playing-changed with the supplied channelId", async () => {
      const { markPlayed } = await setupModule();

      mockDbUpdate.mockReturnValue(buildUpdateChain());

      await markPlayed("entry-1", "channel-abc");

      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.now-playing-changed",
        channelId: "channel-abc",
      });
    });

    it("does not throw when the bus publish throws (fire-and-forget)", async () => {
      const { markPlayed } = await setupModule();

      mockDbUpdate.mockReturnValue(buildUpdateChain());
      mockPublish.mockImplementationOnce(() => { throw new Error("bus failure"); });

      await expect(markPlayed("entry-1", "channel-1")).resolves.toBeUndefined();
    });
  });

  // ── promoteNext ──

  describe("promoteNext", () => {
    it("returns null and issues no UPDATE when no queued entry exists", async () => {
      const { promoteNext } = await setupModule();

      // select returns empty array
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const result = await promoteNext("channel-1");

      expect(result).toBeNull();
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it("returns the promoted row when a queued entry is found", async () => {
      const { promoteNext } = await setupModule();

      const nextRow = makeQueueRow({ id: "entry-2", position: 2, status: "queued" });

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([nextRow]),
            }),
          }),
        }),
      });

      const updateChain = buildUpdateChain();
      mockDbUpdate.mockReturnValue(updateChain);

      const result = await promoteNext("channel-1");

      expect(result).toEqual(nextRow);
    });

    it("issues an UPDATE setting status to 'playing' on the promoted entry", async () => {
      const { promoteNext } = await setupModule();

      const nextRow = makeQueueRow({ id: "entry-2", status: "queued" });

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([nextRow]),
            }),
          }),
        }),
      });

      const updateChain = buildUpdateChain();
      mockDbUpdate.mockReturnValue(updateChain);

      await promoteNext("channel-1");

      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
      const setArg = updateChain.set.mock.calls[0]?.[0] as { status: string };
      expect(setArg).toMatchObject({ status: "playing" });
    });

    it("selects the lowest-position queued entry (orderBy asc position, limit 1)", async () => {
      const { promoteNext } = await setupModule();

      const limitFn = vi.fn().mockResolvedValue([]);
      const orderByFn = vi.fn().mockReturnValue({ limit: limitFn });
      const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDbSelect.mockReturnValue({ from: fromFn });

      await promoteNext("channel-1");

      expect(limitFn).toHaveBeenCalledWith(1);
    });

    it("publishes playout.now-playing-changed with channelId when a row is promoted", async () => {
      const { promoteNext } = await setupModule();

      const nextRow = makeQueueRow({ id: "entry-2", status: "queued" });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([nextRow]),
            }),
          }),
        }),
      });
      mockDbUpdate.mockReturnValue(buildUpdateChain());

      await promoteNext("channel-1");

      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.now-playing-changed",
        channelId: "channel-1",
      });
    });

    it("does not publish when queue is empty (no row promoted)", async () => {
      const { promoteNext } = await setupModule();

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      await promoteNext("channel-1");

      expect(mockPublish).not.toHaveBeenCalled();
    });
  });

  // ── enqueue ──

  describe("enqueue", () => {
    it("appends at MAX+1 when no position given", async () => {
      const { enqueue } = await setupModule();

      // First select: MAX query returns max=2
      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: 2 }]));

      const insertedRow = makeQueueRow({ position: 3 });
      mockDbInsert.mockReturnValue(buildInsertChain([insertedRow]));

      const result = await enqueue({ channelId: "channel-1", source: { playoutItemId: "item-1" } });

      expect(result).toEqual(insertedRow);
      const insertValues = (
        mockDbInsert.mock.results[0]?.value.values.mock.calls[0]?.[0] as {
          position: number;
          status: string;
          pushedToLiquidsoap: boolean;
        }
      );
      expect(insertValues.position).toBe(3); // max(2) + 1
      expect(insertValues.status).toBe("queued");
      expect(insertValues.pushedToLiquidsoap).toBe(false);
    });

    it("returns null when INSERT returns no rows", async () => {
      const { enqueue } = await setupModule();

      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: null }]));
      mockDbInsert.mockReturnValue(buildInsertChain([]));

      const result = await enqueue({ channelId: "channel-1", source: { playoutItemId: "item-1" } });

      expect(result).toBeNull();
    });

    it("uses position 1 when queue is empty (max is null)", async () => {
      const { enqueue } = await setupModule();

      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: null }]));

      const insertedRow = makeQueueRow({ position: 1 });
      mockDbInsert.mockReturnValue(buildInsertChain([insertedRow]));

      await enqueue({ channelId: "channel-1", source: { playoutItemId: "item-1" } });

      const insertValues = (
        mockDbInsert.mock.results[0]?.value.values.mock.calls[0]?.[0] as {
          position: number;
        }
      );
      expect(insertValues.position).toBe(1); // null+1 = 0+1 = 1
    });

    it("shifts queued entries then inserts at given position", async () => {
      const { enqueue } = await setupModule();

      // No select needed when position is given (no MAX query)
      const updateChain = buildUpdateChain();
      mockDbUpdate.mockReturnValue(updateChain);

      const insertedRow = makeQueueRow({ position: 2 });
      mockDbInsert.mockReturnValue(buildInsertChain([insertedRow]));

      const result = await enqueue({
        channelId: "channel-1",
        source: { playoutItemId: "item-1" },
        position: 2,
      });

      expect(result).toEqual(insertedRow);
      // UPDATE to shift positions was issued
      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
      // No SELECT was needed (position given, so no MAX query)
      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    it("inserts with status 'queued' and pushedToLiquidsoap false in both branches", async () => {
      const { enqueue } = await setupModule();

      // position-given branch
      mockDbUpdate.mockReturnValue(buildUpdateChain());
      const insertedRow = makeQueueRow({ position: 2 });
      mockDbInsert.mockReturnValue(buildInsertChain([insertedRow]));

      await enqueue({ channelId: "channel-1", source: { playoutItemId: "item-1" }, position: 2 });

      const insertValues = (
        mockDbInsert.mock.results[0]?.value.values.mock.calls[0]?.[0] as {
          status: string;
          pushedToLiquidsoap: boolean;
        }
      );
      expect(insertValues.status).toBe("queued");
      expect(insertValues.pushedToLiquidsoap).toBe(false);
    });

    it("publishes playout.queue-changed when insert succeeds", async () => {
      const { enqueue } = await setupModule();

      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: 0 }]));
      const insertedRow = makeQueueRow({ position: 1 });
      mockDbInsert.mockReturnValue(buildInsertChain([insertedRow]));

      await enqueue({ channelId: "channel-1", source: { playoutItemId: "item-1" } });

      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.queue-changed",
        channelId: "channel-1",
      });
    });

    it("does not publish when INSERT returns no rows", async () => {
      const { enqueue } = await setupModule();

      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: null }]));
      mockDbInsert.mockReturnValue(buildInsertChain([]));

      await enqueue({ channelId: "channel-1", source: { playoutItemId: "item-1" } });

      expect(mockPublish).not.toHaveBeenCalled();
    });

    // ── content source ──

    it("writes a content_id row with playout_item_id null/absent when given a content source", async () => {
      const { enqueue } = await setupModule();

      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: 0 }]));
      const insertedRow = makeQueueRow({
        position: 1,
        playoutItemId: null,
        contentId: "content-1",
      });
      mockDbInsert.mockReturnValue(buildInsertChain([insertedRow]));

      const result = await enqueue({
        channelId: "channel-1",
        source: { contentId: "content-1" },
      });

      expect(result).toEqual(insertedRow);
      const insertValues = (
        mockDbInsert.mock.results[0]?.value.values.mock.calls[0]?.[0] as {
          playoutItemId?: string;
          contentId?: string;
        }
      );
      // exactly-one source: contentId is set, playoutItemId is omitted (→ NULL column)
      expect(insertValues.contentId).toBe("content-1");
      expect(insertValues.playoutItemId).toBeUndefined();
      expect("playoutItemId" in insertValues).toBe(false);
    });
  });

  // ── enqueueBatch ──

  describe("enqueueBatch", () => {
    it("returns 0 and does nothing when given empty array", async () => {
      const { enqueueBatch } = await setupModule();

      const count = await enqueueBatch("channel-1", []);

      expect(count).toBe(0);
      expect(mockDbSelect).not.toHaveBeenCalled();
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it("inserts all items at consecutive positions starting from MAX+1", async () => {
      const { enqueueBatch } = await setupModule();

      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: 1 }]));
      mockDbInsert.mockReturnValue(buildInsertChainNoReturn());

      const count = await enqueueBatch("channel-1", [
        { playoutItemId: "item-1" },
        { playoutItemId: "item-2" },
        { playoutItemId: "item-3" },
      ]);

      expect(count).toBe(3);
      const inserted = (
        mockDbInsert.mock.results[0]?.value.values.mock.calls[0]?.[0] as Array<{
          playoutItemId: string;
          position: number;
          status: string;
          pushedToLiquidsoap: boolean;
        }>
      );
      expect(inserted).toHaveLength(3);
      expect(inserted[0]?.position).toBe(2); // max(1) + 1
      expect(inserted[1]?.position).toBe(3);
      expect(inserted[2]?.position).toBe(4);
      expect(inserted[0]?.playoutItemId).toBe("item-1");
      expect(inserted.every((r) => r.status === "queued")).toBe(true);
      expect(inserted.every((r) => r.pushedToLiquidsoap === false)).toBe(true);
    });

    it("starts from position 1 when the queue is empty (max is null)", async () => {
      const { enqueueBatch } = await setupModule();

      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: null }]));
      mockDbInsert.mockReturnValue(buildInsertChainNoReturn());

      await enqueueBatch("channel-1", [
        { playoutItemId: "item-1" },
        { playoutItemId: "item-2" },
      ]);

      const inserted = (
        mockDbInsert.mock.results[0]?.value.values.mock.calls[0]?.[0] as Array<{
          position: number;
        }>
      );
      expect(inserted[0]?.position).toBe(1);
      expect(inserted[1]?.position).toBe(2);
    });

    it("publishes playout.queue-changed when count > 0", async () => {
      const { enqueueBatch } = await setupModule();

      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: 0 }]));
      mockDbInsert.mockReturnValue(buildInsertChainNoReturn());

      await enqueueBatch("channel-1", [{ playoutItemId: "item-1" }]);

      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.queue-changed",
        channelId: "channel-1",
      });
    });

    it("inserts content_id rows with playout_item_id absent for content sources", async () => {
      const { enqueueBatch } = await setupModule();

      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: 0 }]));
      mockDbInsert.mockReturnValue(buildInsertChainNoReturn());

      const count = await enqueueBatch("channel-1", [
        { contentId: "content-1" },
        { contentId: "content-2" },
      ]);

      expect(count).toBe(2);
      const inserted = (
        mockDbInsert.mock.results[0]?.value.values.mock.calls[0]?.[0] as Array<{
          playoutItemId?: string;
          contentId?: string;
          position: number;
        }>
      );
      expect(inserted).toHaveLength(2);
      // each row sets exactly contentId; playoutItemId omitted → NULL column
      expect(inserted[0]?.contentId).toBe("content-1");
      expect(inserted[1]?.contentId).toBe("content-2");
      expect(inserted.every((r) => !("playoutItemId" in r))).toBe(true);
      expect(inserted[0]?.position).toBe(1);
      expect(inserted[1]?.position).toBe(2);
    });

    it("does not publish when given empty array", async () => {
      const { enqueueBatch } = await setupModule();

      await enqueueBatch("channel-1", []);

      expect(mockPublish).not.toHaveBeenCalled();
    });
  });

  // ── removeQueued ──

  describe("removeQueued", () => {
    it("returns err CANNOT_REMOVE_PLAYING when status is 'playing'", async () => {
      const { removeQueued } = await setupModule();

      const result = await removeQueued({ id: "entry-1", channelId: "channel-1", status: "playing" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("CANNOT_REMOVE_PLAYING");
      expect(result.error.statusCode).toBe(409);
      expect(mockDbDelete).not.toHaveBeenCalled();
    });

    it("deletes the entry and returns ok when status is 'queued'", async () => {
      const { removeQueued } = await setupModule();

      const deleteChain = buildDeleteChain();
      mockDbDelete.mockReturnValue(deleteChain);

      const result = await removeQueued({ id: "entry-1", channelId: "channel-1", status: "queued" });

      expect(result.ok).toBe(true);
      expect(mockDbDelete).toHaveBeenCalledTimes(1);
      expect(deleteChain.where).toHaveBeenCalledTimes(1);
    });

    it("deletes the entry and returns ok when status is 'played'", async () => {
      const { removeQueued } = await setupModule();

      const deleteChain = buildDeleteChain();
      mockDbDelete.mockReturnValue(deleteChain);

      const result = await removeQueued({ id: "entry-1", channelId: "channel-1", status: "played" });

      expect(result.ok).toBe(true);
      expect(mockDbDelete).toHaveBeenCalledTimes(1);
    });

    it("does not re-read the entry from the database", async () => {
      const { removeQueued } = await setupModule();

      mockDbDelete.mockReturnValue(buildDeleteChain());

      await removeQueued({ id: "entry-1", channelId: "channel-1", status: "queued" });

      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    it("publishes playout.queue-changed on success", async () => {
      const { removeQueued } = await setupModule();

      mockDbDelete.mockReturnValue(buildDeleteChain());

      await removeQueued({ id: "entry-1", channelId: "channel-1", status: "queued" });

      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.queue-changed",
        channelId: "channel-1",
      });
    });

    it("does not publish when status is 'playing' (error path)", async () => {
      const { removeQueued } = await setupModule();

      await removeQueued({ id: "entry-1", channelId: "channel-1", status: "playing" });

      expect(mockPublish).not.toHaveBeenCalled();
    });
  });

  // ── content.playout-changed — creator vs. platform channel conditional ──

  describe("content.playout-changed conditional emit", () => {
    // ── markPlayed ──

    it("markPlayed: creator channel — publishes both playout.now-playing-changed AND content.playout-changed", async () => {
      const { markPlayed } = await setupModule();
      setupCreatorChannel("creator-xyz");
      mockDbUpdate.mockReturnValue(buildUpdateChain());

      await markPlayed("entry-1", "ch-creator");

      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.now-playing-changed",
        channelId: "ch-creator",
      });
      expect(mockPublish).toHaveBeenCalledWith({
        type: "content.playout-changed",
        channelId: "ch-creator",
        creatorId: "creator-xyz",
        changeType: "now-playing",
      });
      expect(mockPublish).toHaveBeenCalledTimes(2);
    });

    it("markPlayed: platform channel — publishes ONLY playout.now-playing-changed (no content event)", async () => {
      const { markPlayed } = await setupModule();
      // beforeEach already sets platform channel (null)
      mockDbUpdate.mockReturnValue(buildUpdateChain());

      await markPlayed("entry-1", "ch-platform");

      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.now-playing-changed",
        channelId: "ch-platform",
      });
      expect(mockPublish).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "content.playout-changed" }),
      );
      expect(mockPublish).toHaveBeenCalledTimes(1);
    });

    // ── promoteNext ──

    it("promoteNext: creator channel — publishes both playout.now-playing-changed AND content.playout-changed", async () => {
      const { promoteNext } = await setupModule();
      setupCreatorChannel("creator-xyz");

      const nextRow = makeQueueRow({ id: "entry-2", status: "queued" });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([nextRow]),
            }),
          }),
        }),
      });
      mockDbUpdate.mockReturnValue(buildUpdateChain());

      await promoteNext("ch-creator");

      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.now-playing-changed",
        channelId: "ch-creator",
      });
      expect(mockPublish).toHaveBeenCalledWith({
        type: "content.playout-changed",
        channelId: "ch-creator",
        creatorId: "creator-xyz",
        changeType: "now-playing",
      });
      expect(mockPublish).toHaveBeenCalledTimes(2);
    });

    it("promoteNext: platform channel — publishes ONLY playout.now-playing-changed", async () => {
      const { promoteNext } = await setupModule();
      // beforeEach: platform channel

      const nextRow = makeQueueRow({ id: "entry-2", status: "queued" });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([nextRow]),
            }),
          }),
        }),
      });
      mockDbUpdate.mockReturnValue(buildUpdateChain());

      await promoteNext("ch-platform");

      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.now-playing-changed",
        channelId: "ch-platform",
      });
      expect(mockPublish).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "content.playout-changed" }),
      );
      expect(mockPublish).toHaveBeenCalledTimes(1);
    });

    // ── enqueue ──

    it("enqueue: creator channel — publishes both playout.queue-changed AND content.playout-changed", async () => {
      const { enqueue } = await setupModule();
      setupCreatorChannel("creator-xyz");

      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: 0 }]));
      const insertedRow = makeQueueRow({ position: 1 });
      mockDbInsert.mockReturnValue(buildInsertChain([insertedRow]));

      await enqueue({ channelId: "ch-creator", source: { playoutItemId: "item-1" } });

      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.queue-changed",
        channelId: "ch-creator",
      });
      expect(mockPublish).toHaveBeenCalledWith({
        type: "content.playout-changed",
        channelId: "ch-creator",
        creatorId: "creator-xyz",
        changeType: "queue",
      });
      expect(mockPublish).toHaveBeenCalledTimes(2);
    });

    it("enqueue: platform channel — publishes ONLY playout.queue-changed", async () => {
      const { enqueue } = await setupModule();
      // beforeEach: platform channel

      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: 0 }]));
      const insertedRow = makeQueueRow({ position: 1 });
      mockDbInsert.mockReturnValue(buildInsertChain([insertedRow]));

      await enqueue({ channelId: "ch-platform", source: { playoutItemId: "item-1" } });

      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.queue-changed",
        channelId: "ch-platform",
      });
      expect(mockPublish).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "content.playout-changed" }),
      );
      expect(mockPublish).toHaveBeenCalledTimes(1);
    });

    // ── enqueueBatch ──

    it("enqueueBatch: creator channel — publishes both playout.queue-changed AND content.playout-changed", async () => {
      const { enqueueBatch } = await setupModule();
      setupCreatorChannel("creator-xyz");

      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: 0 }]));
      mockDbInsert.mockReturnValue(buildInsertChainNoReturn());

      await enqueueBatch("ch-creator", [{ playoutItemId: "item-1" }]);

      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.queue-changed",
        channelId: "ch-creator",
      });
      expect(mockPublish).toHaveBeenCalledWith({
        type: "content.playout-changed",
        channelId: "ch-creator",
        creatorId: "creator-xyz",
        changeType: "queue",
      });
      expect(mockPublish).toHaveBeenCalledTimes(2);
    });

    it("enqueueBatch: platform channel — publishes ONLY playout.queue-changed", async () => {
      const { enqueueBatch } = await setupModule();
      // beforeEach: platform channel

      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: 0 }]));
      mockDbInsert.mockReturnValue(buildInsertChainNoReturn());

      await enqueueBatch("ch-platform", [{ playoutItemId: "item-1" }]);

      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.queue-changed",
        channelId: "ch-platform",
      });
      expect(mockPublish).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "content.playout-changed" }),
      );
      expect(mockPublish).toHaveBeenCalledTimes(1);
    });

    // ── removeQueued ──

    it("removeQueued: creator channel — publishes both playout.queue-changed AND content.playout-changed", async () => {
      const { removeQueued } = await setupModule();
      setupCreatorChannel("creator-xyz");
      mockDbDelete.mockReturnValue(buildDeleteChain());

      await removeQueued({ id: "entry-1", channelId: "ch-creator", status: "queued" });

      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.queue-changed",
        channelId: "ch-creator",
      });
      expect(mockPublish).toHaveBeenCalledWith({
        type: "content.playout-changed",
        channelId: "ch-creator",
        creatorId: "creator-xyz",
        changeType: "queue",
      });
      expect(mockPublish).toHaveBeenCalledTimes(2);
    });

    it("removeQueued: platform channel — publishes ONLY playout.queue-changed", async () => {
      const { removeQueued } = await setupModule();
      // beforeEach: platform channel
      mockDbDelete.mockReturnValue(buildDeleteChain());

      await removeQueued({ id: "entry-1", channelId: "ch-platform", status: "queued" });

      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.queue-changed",
        channelId: "ch-platform",
      });
      expect(mockPublish).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "content.playout-changed" }),
      );
      expect(mockPublish).toHaveBeenCalledTimes(1);
    });

    it("removeQueued: channel lookup failure — still completes successfully (fire-and-forget)", async () => {
      const { removeQueued } = await setupModule();
      mockFindChannelCreatorId.mockRejectedValue(new Error("db error"));
      mockDbDelete.mockReturnValue(buildDeleteChain());

      const result = await removeQueued({ id: "entry-1", channelId: "ch-any", status: "queued" });

      expect(result.ok).toBe(true);
      // playout.queue-changed still fires; content.playout-changed does not (lookup failed)
      expect(mockPublish).toHaveBeenCalledWith({
        type: "playout.queue-changed",
        channelId: "ch-any",
      });
      expect(mockPublish).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "content.playout-changed" }),
      );
    });
  });
});
