import { describe, it, expect, vi, afterEach } from "vitest";

// ── Module Setup ──

const setupModule = async () => {
  const mockResolveAudience = vi.fn();

  const mockSelectWhere = vi.fn();
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

  const mockInsertValues = vi.fn().mockResolvedValue(undefined);
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

  const mockDb = { select: mockSelect, insert: mockInsert };

  const mockBossSend = vi.fn().mockResolvedValue("job-id");
  const mockBoss = { send: mockBossSend };
  const mockGetBoss = vi.fn().mockReturnValue(mockBoss);

  const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  vi.doMock("../../src/config.js", () => ({ config: {} }));
  vi.doMock("../../src/db/connection.js", () => ({ db: mockDb }));
  vi.doMock("../../src/db/schema/notification.schema.js", () => ({
    notificationPreferences: { userId: {}, eventType: {}, channel: {}, enabled: {} },
    notificationJobs: { id: {} },
  }));
  vi.doMock("../../src/jobs/boss.js", () => ({ getBoss: mockGetBoss }));
  vi.doMock("../../src/jobs/register-workers.js", () => ({
    JOB_QUEUES: { NOTIFICATION_SEND: "notification/send" },
  }));
  vi.doMock("../../src/services/follows.js", () => ({
    resolveAudience: mockResolveAudience,
  }));
  vi.doMock("../../src/logging/logger.js", () => ({
    rootLogger: mockLogger,
  }));
  vi.doMock("../../src/services/notification-inbox.js", () => ({
    createNotification: vi.fn().mockResolvedValue({ ok: true, value: {} }),
  }));
  vi.doMock("../../src/db/schema/notification-inbox.schema.js", () => ({
    inboxNotifications: { id: {}, userId: {}, type: {}, title: {}, body: {}, actionUrl: {}, read: {}, createdAt: {} },
  }));

  const { dispatchNotification } = await import("../../src/services/notification-dispatch.js");

  return {
    dispatchNotification,
    mockResolveAudience,
    mockSelectWhere,
    mockBossSend,
    mockInsertValues,
    mockGetBoss,
    mockBoss,
    mockLogger,
  };
};

// ── Tests ──

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

describe("dispatchNotification", () => {
  it("is a no-op when pg-boss is not started", async () => {
    const { dispatchNotification, mockGetBoss, mockResolveAudience, mockBossSend, mockLogger } =
      await setupModule();
    mockGetBoss.mockReturnValueOnce(null);

    await dispatchNotification({ eventType: "go_live", creatorId: "creator-1", payload: {} });

    expect(mockResolveAudience).not.toHaveBeenCalled();
    expect(mockBossSend).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("pg-boss not started"));
  });

  it("enqueues one job per eligible recipient", async () => {
    const { dispatchNotification, mockResolveAudience, mockSelectWhere, mockBossSend, mockInsertValues } =
      await setupModule();

    mockResolveAudience.mockResolvedValue([
      { userId: "user-1", email: "a@test.com", name: "Alice" },
      { userId: "user-2", email: "b@test.com", name: "Bob" },
    ]);
    // Both users have no preference row (default enabled)
    mockSelectWhere.mockResolvedValue([]);

    await dispatchNotification({
      eventType: "go_live",
      creatorId: "creator-1",
      payload: { creatorName: "Test Creator", liveUrl: "https://example.com/live" },
    });

    expect(mockBossSend).toHaveBeenCalledTimes(2);
    expect(mockInsertValues).toHaveBeenCalledTimes(2);
  });

  it("skips recipients who have opted out", async () => {
    const { dispatchNotification, mockResolveAudience, mockSelectWhere, mockBossSend, mockInsertValues } =
      await setupModule();

    mockResolveAudience.mockResolvedValue([
      { userId: "user-1", email: "a@test.com", name: "Alice" },
    ]);
    // user-1 has opted out
    mockSelectWhere.mockResolvedValueOnce([
      { userId: "user-1", eventType: "go_live", channel: "email", enabled: false },
    ]);

    await dispatchNotification({
      eventType: "go_live",
      creatorId: "creator-1",
      payload: {},
    });

    expect(mockBossSend).not.toHaveBeenCalled();
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("includes correct job data in enqueued pg-boss job", async () => {
    const { dispatchNotification, mockResolveAudience, mockSelectWhere, mockBossSend } =
      await setupModule();

    mockResolveAudience.mockResolvedValue([
      { userId: "user-1", email: "fan@test.com", name: "Fan" },
    ]);
    mockSelectWhere.mockResolvedValue([]);

    const payload = { creatorName: "Test Creator", creatorId: "creator-1", liveUrl: "https://s-nc.org/live" };
    await dispatchNotification({ eventType: "go_live", creatorId: "creator-1", payload });

    expect(mockBossSend).toHaveBeenCalledWith(
      "notification/send",
      expect.objectContaining({
        userId: "user-1",
        email: "fan@test.com",
        name: "Fan",
        eventType: "go_live",
        payload,
      }),
    );
  });
});
