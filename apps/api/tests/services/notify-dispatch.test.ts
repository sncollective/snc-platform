import { describe, it, expect, vi, afterEach } from "vitest";

// ── Module Setup ──

const setupModule = async () => {
  // Queue of results the chained db.select() will resolve to, in call order.
  const selectResults: unknown[][] = [];
  const enqueueResult = (rows: unknown[]) => selectResults.push(rows);

  // A chainable that resolves (when awaited) to the next queued result.
  const makeChain = () => {
    const result = selectResults.shift() ?? [];
    const chain: Record<string, unknown> = {
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      limit: () => Promise.resolve(result),
      then: (resolve: (v: unknown) => unknown) => resolve(result),
    };
    return chain;
  };

  const mockSelect = vi.fn(() => makeChain());
  const mockInsertValues = vi.fn().mockResolvedValue(undefined);
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
  const mockDb = { select: mockSelect, insert: mockInsert };

  const mockBossSend = vi.fn().mockResolvedValue("job-id");
  const mockGetBoss = vi.fn().mockReturnValue({ send: mockBossSend });
  const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  vi.doMock("../../src/config.js", () => ({ config: { BETTER_AUTH_URL: "http://x" } }));
  vi.doMock("../../src/db/connection.js", () => ({ db: mockDb }));
  vi.doMock("../../src/db/schema/notification.schema.js", () => ({
    channelNotifySubscriptions: { userId: {}, channelId: {} },
    notificationJobs: { id: {} },
    notificationPreferences: { userId: {}, eventType: {}, channel: {}, enabled: {} },
  }));
  vi.doMock("../../src/db/schema/streaming.schema.js", () => ({ channels: { id: {}, name: {} } }));
  vi.doMock("../../src/db/schema/user.schema.js", () => ({ users: { id: {}, email: {}, name: {} } }));
  vi.doMock("../../src/jobs/boss.js", () => ({ getBoss: mockGetBoss }));
  vi.doMock("../../src/jobs/queue-names.js", () => ({
    JOB_QUEUES: { NOTIFICATION_SEND: "notification/send" },
  }));
  vi.doMock("../../src/logging/logger.js", () => ({ rootLogger: mockLogger }));

  const { dispatchChannelGoLive } = await import("../../src/services/notify-dispatch.js");

  return { dispatchChannelGoLive, enqueueResult, mockBossSend, mockInsertValues };
};

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

/** Queue the per-call db results: [channel row], [audience], [preference] per subscriber. */
const seedOneSubscriber = (
  enqueue: (rows: unknown[]) => void,
  channelName = "S/NC TV",
) => {
  enqueue([{ name: channelName }]); // channel lookup
  enqueue([{ userId: "u1", email: "u1@example.com", name: "U One" }]); // audience
  enqueue([]); // preference lookup (absent → enabled)
};

describe("dispatchChannelGoLive", () => {
  it("enqueues one job per subscriber on a fresh go-live", async () => {
    const { dispatchChannelGoLive, enqueueResult, mockBossSend } = await setupModule();
    seedOneSubscriber(enqueueResult);

    await dispatchChannelGoLive("ch-1", 1_000);

    expect(mockBossSend).toHaveBeenCalledTimes(1);
    expect(mockBossSend.mock.calls[0]![1]).toMatchObject({
      email: "u1@example.com",
      eventType: "channel_go_live",
    });
  });

  it("suppresses a repeat go-live within the cooldown", async () => {
    const { dispatchChannelGoLive, enqueueResult, mockBossSend } = await setupModule();
    seedOneSubscriber(enqueueResult);

    await dispatchChannelGoLive("ch-1", 1_000);
    expect(mockBossSend).toHaveBeenCalledTimes(1);

    // 1 minute later — well within the 10-minute cooldown → suppressed.
    await dispatchChannelGoLive("ch-1", 1_000 + 60_000);
    expect(mockBossSend).toHaveBeenCalledTimes(1);
  });

  it("re-dispatches after the cooldown window elapses", async () => {
    const { dispatchChannelGoLive, enqueueResult, mockBossSend } = await setupModule();
    seedOneSubscriber(enqueueResult);
    await dispatchChannelGoLive("ch-1", 1_000);

    // 11 minutes later — past the 10-minute cooldown → re-dispatches.
    seedOneSubscriber(enqueueResult);
    await dispatchChannelGoLive("ch-1", 1_000 + 11 * 60_000);
    expect(mockBossSend).toHaveBeenCalledTimes(2);
  });

  it("skips a subscriber whose channel_go_live email preference is disabled", async () => {
    const { dispatchChannelGoLive, enqueueResult, mockBossSend } = await setupModule();
    enqueueResult([{ name: "S/NC TV" }]); // channel
    enqueueResult([{ userId: "u1", email: "u1@example.com", name: "U One" }]); // audience
    enqueueResult([{ enabled: false }]); // preference disabled

    await dispatchChannelGoLive("ch-1", 1_000);
    expect(mockBossSend).not.toHaveBeenCalled();
  });
});
