import { afterEach, describe, expect, it, vi } from "vitest";

// ── Mock DB State ──

const mockDbSelect = vi.fn();

// ── Deferred Query Helpers ──

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

// ── Fixtures ──

const makeChannelRow = (overrides: Record<string, unknown> = {}) => ({
  id: "channel-1",
  name: "S/NC Classics",
  ...overrides,
});

const makeQueueRow = (overrides: Record<string, unknown> = {}) => ({
  id: "queue-1",
  channelId: "channel-1",
  playoutItemId: "item-1",
  contentId: null,
  position: 1,
  status: "queued",
  pushedToLiquidsoap: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  sourceType: "playout",
  title: "Library Film",
  duration: 90,
  ...overrides,
});

// ── Module Setup ──

const setupModule = async () => {
  vi.doMock("../../src/db/connection.js", () => ({
    db: { select: mockDbSelect },
  }));

  vi.doMock("../../src/db/schema/content.schema.js", () => ({
    content: { id: {}, title: {}, duration: {} },
  }));

  vi.doMock("../../src/db/schema/playout-queue.schema.js", () => ({
    channelContent: { channelId: {} },
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

  vi.doMock("../../src/db/schema/playout.schema.js", () => ({
    playoutItems: { id: {}, title: {}, duration: {} },
  }));

  vi.doMock("../../src/db/schema/streaming.schema.js", () => ({
    channels: { id: {}, name: {} },
  }));

  return import("../../src/services/playout/queue-status.js");
};

const buildChannelLookupChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(rows),
  }),
});

// ── Tests ──

describe("playout queue status", () => {
  afterEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("runs single-channel queue and pool reads concurrently after the channel guard", async () => {
    const { getChannelQueueStatus } = await setupModule();
    const queueRows = createDeferred<unknown[]>();
    const poolRows = createDeferred<Array<{ count: number }>>();

    const queueOrderBy = vi.fn(() => queueRows.promise);
    const poolWhere = vi.fn(() => poolRows.promise);

    mockDbSelect
      .mockReturnValueOnce(buildChannelLookupChain([makeChannelRow()]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({ orderBy: queueOrderBy }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: poolWhere }),
      });

    const statusPromise = getChannelQueueStatus("channel-1");
    let settled = false;
    const observedStatusPromise = (async () => {
      const result = await statusPromise;
      settled = true;
      return result;
    })();

    await flushMicrotasks();

    expect(queueOrderBy).toHaveBeenCalledTimes(1);
    expect(poolWhere).toHaveBeenCalledTimes(1);

    poolRows.resolve([{ count: 7 }]);
    await flushMicrotasks();
    expect(settled).toBe(false);

    queueRows.resolve([
      makeQueueRow({
        id: "now-playing",
        status: "playing",
        pushedToLiquidsoap: true,
        title: "Now Playing",
      }),
      makeQueueRow({
        id: "up-next",
        playoutItemId: null,
        contentId: "content-1",
        position: 2,
        sourceType: "content",
        title: "Creator Video",
        duration: 120,
      }),
    ]);

    const result = await observedStatusPromise;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      channelId: "channel-1",
      channelName: "S/NC Classics",
      poolSize: 7,
    });
    expect(result.value.nowPlaying).toMatchObject({
      id: "now-playing",
      sourceType: "playout",
      title: "Now Playing",
      status: "playing",
    });
    expect(result.value.upcoming).toEqual([
      expect.objectContaining({
        id: "up-next",
        contentId: "content-1",
        sourceType: "content",
        title: "Creator Video",
        duration: 120,
      }),
    ]);
  });

  it("returns NOT_FOUND before queue or pool reads when the channel guard finds no row", async () => {
    const { getChannelQueueStatus } = await setupModule();

    mockDbSelect.mockReturnValueOnce(buildChannelLookupChain([]));

    const result = await getChannelQueueStatus("missing-channel");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
  });

  it("runs multi-channel channel, queue, and pool reads concurrently", async () => {
    const { getMultiChannelQueueStatus } = await setupModule();
    const channelRows = createDeferred<unknown[]>();
    const queueRows = createDeferred<unknown[]>();
    const poolRows = createDeferred<Array<{ channelId: string; count: number }>>();

    const channelWhere = vi.fn(() => channelRows.promise);
    const queueOrderBy = vi.fn(() => queueRows.promise);
    const poolGroupBy = vi.fn(() => poolRows.promise);

    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({ where: channelWhere }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({ orderBy: queueOrderBy }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ groupBy: poolGroupBy }),
        }),
      });

    const statusPromise = getMultiChannelQueueStatus(["channel-1", "channel-2"]);
    let settled = false;
    const observedStatusPromise = (async () => {
      const result = await statusPromise;
      settled = true;
      return result;
    })();

    await flushMicrotasks();

    expect(channelWhere).toHaveBeenCalledTimes(1);
    expect(queueOrderBy).toHaveBeenCalledTimes(1);
    expect(poolGroupBy).toHaveBeenCalledTimes(1);

    poolRows.resolve([{ channelId: "channel-2", count: 3 }]);
    queueRows.resolve([
      makeQueueRow({ id: "channel-2-now", channelId: "channel-2", status: "playing" }),
      makeQueueRow({ id: "channel-1-next", channelId: "channel-1", position: 2 }),
    ]);
    await flushMicrotasks();
    expect(settled).toBe(false);

    channelRows.resolve([
      makeChannelRow({ id: "channel-1", name: "Channel One" }),
      makeChannelRow({ id: "channel-2", name: "Channel Two" }),
    ]);

    const result = await observedStatusPromise;

    expect(result.get("channel-1")).toMatchObject({
      channelId: "channel-1",
      channelName: "Channel One",
      nowPlaying: null,
      poolSize: 0,
    });
    expect(result.get("channel-1")?.upcoming).toEqual([
      expect.objectContaining({ id: "channel-1-next", status: "queued" }),
    ]);
    expect(result.get("channel-2")).toMatchObject({
      channelId: "channel-2",
      channelName: "Channel Two",
      poolSize: 3,
    });
    expect(result.get("channel-2")?.nowPlaying).toMatchObject({
      id: "channel-2-now",
      status: "playing",
    });
  });
});
