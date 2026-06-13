import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock DB State ──

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();

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
      position: {},
      status: {},
      pushedToLiquidsoap: {},
      createdAt: {},
    },
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
  afterEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  // ── markPlayed ──

  describe("markPlayed", () => {
    it("issues an UPDATE setting status to 'played' for the given entry id", async () => {
      const { markPlayed } = await setupModule();

      const updateChain = buildUpdateChain();
      mockDbUpdate.mockReturnValue(updateChain);

      await markPlayed("entry-1");

      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
      expect(updateChain.set).toHaveBeenCalledTimes(1);
      const setArg = updateChain.set.mock.calls[0]?.[0] as { status: string };
      expect(setArg).toMatchObject({ status: "played" });
      expect(updateChain.set.mock.results[0]?.value.where).toHaveBeenCalledTimes(1);
    });

    it("does not issue any selects or inserts", async () => {
      const { markPlayed } = await setupModule();

      mockDbUpdate.mockReturnValue(buildUpdateChain());

      await markPlayed("entry-1");

      expect(mockDbSelect).not.toHaveBeenCalled();
      expect(mockDbInsert).not.toHaveBeenCalled();
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
  });

  // ── enqueue ──

  describe("enqueue", () => {
    it("appends at MAX+1 when no position given", async () => {
      const { enqueue } = await setupModule();

      // First select: MAX query returns max=2
      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: 2 }]));

      const insertedRow = makeQueueRow({ position: 3 });
      mockDbInsert.mockReturnValue(buildInsertChain([insertedRow]));

      const result = await enqueue({ channelId: "channel-1", playoutItemId: "item-1" });

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

      const result = await enqueue({ channelId: "channel-1", playoutItemId: "item-1" });

      expect(result).toBeNull();
    });

    it("uses position 1 when queue is empty (max is null)", async () => {
      const { enqueue } = await setupModule();

      mockDbSelect.mockReturnValue(buildSimpleSelectChain([{ max: null }]));

      const insertedRow = makeQueueRow({ position: 1 });
      mockDbInsert.mockReturnValue(buildInsertChain([insertedRow]));

      await enqueue({ channelId: "channel-1", playoutItemId: "item-1" });

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
        playoutItemId: "item-1",
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

      await enqueue({ channelId: "channel-1", playoutItemId: "item-1", position: 2 });

      const insertValues = (
        mockDbInsert.mock.results[0]?.value.values.mock.calls[0]?.[0] as {
          status: string;
          pushedToLiquidsoap: boolean;
        }
      );
      expect(insertValues.status).toBe("queued");
      expect(insertValues.pushedToLiquidsoap).toBe(false);
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

      const count = await enqueueBatch("channel-1", ["item-1", "item-2", "item-3"]);

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

      await enqueueBatch("channel-1", ["item-1", "item-2"]);

      const inserted = (
        mockDbInsert.mock.results[0]?.value.values.mock.calls[0]?.[0] as Array<{
          position: number;
        }>
      );
      expect(inserted[0]?.position).toBe(1);
      expect(inserted[1]?.position).toBe(2);
    });
  });

  // ── removeQueued ──

  describe("removeQueued", () => {
    it("returns err CANNOT_REMOVE_PLAYING when status is 'playing'", async () => {
      const { removeQueued } = await setupModule();

      const result = await removeQueued({ id: "entry-1", status: "playing" });

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

      const result = await removeQueued({ id: "entry-1", status: "queued" });

      expect(result.ok).toBe(true);
      expect(mockDbDelete).toHaveBeenCalledTimes(1);
      expect(deleteChain.where).toHaveBeenCalledTimes(1);
    });

    it("deletes the entry and returns ok when status is 'played'", async () => {
      const { removeQueued } = await setupModule();

      const deleteChain = buildDeleteChain();
      mockDbDelete.mockReturnValue(deleteChain);

      const result = await removeQueued({ id: "entry-1", status: "played" });

      expect(result.ok).toBe(true);
      expect(mockDbDelete).toHaveBeenCalledTimes(1);
    });

    it("does not re-read the entry from the database", async () => {
      const { removeQueued } = await setupModule();

      mockDbDelete.mockReturnValue(buildDeleteChain());

      await removeQueued({ id: "entry-1", status: "queued" });

      expect(mockDbSelect).not.toHaveBeenCalled();
    });
  });
});
