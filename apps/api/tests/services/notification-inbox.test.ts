import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock State ──

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockSendToUser = vi.fn();

// ── Setup Factory ──

const setupService = async () => {
  vi.doMock("../../src/db/connection.js", () => ({
    db: {
      select: mockDbSelect,
      insert: mockDbInsert,
      update: mockDbUpdate,
    },
    sql: vi.fn(),
  }));
  vi.doMock("../../src/db/schema/notification-inbox.schema.js", () => ({
    inboxNotifications: {
      id: "id",
      userId: "userId",
      type: "type",
      title: "title",
      body: "body",
      actionUrl: "actionUrl",
      read: "read",
      createdAt: "createdAt",
    },
  }));
  vi.doMock("../../src/services/chat-rooms.js", () => ({
    sendToUser: mockSendToUser,
  }));
  return await import("../../src/services/notification-inbox.js");
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── DB Chain Helpers ──

/** .from().where() → resolves to rows */
const buildSelectWhereChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(rows),
  }),
});

/** .from().where().orderBy().limit() → resolves to rows */
const buildSelectWhereOrderByLimitChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  }),
});

/** insert .values().returning() → resolves to rows */
const buildInsertReturningChain = (rows: unknown[]) => ({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(rows),
  }),
});

/** update .set().where() → resolves to rows */
const buildUpdateSetWhereReturningChain = (rows: unknown[]) => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(rows),
    }),
  }),
});

/** update .set().where() (no returning) → resolves */
const buildUpdateSetWhereChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  }),
});

// ── Fixtures ──

const makeNotificationRow = (overrides?: Partial<{
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  read: boolean;
  createdAt: Date;
}>) => ({
  id: "notif-1",
  userId: "user-1",
  type: "go_live",
  title: "Stream is live!",
  body: "Creator is streaming",
  actionUrl: null,
  read: false,
  createdAt: new Date("2026-04-01T10:00:00Z"),
  ...overrides,
});

// ── Tests ──

describe("notification inbox service", () => {
  describe("createNotification", () => {
    it("inserts row and returns formatted notification", async () => {
      const row = makeNotificationRow();
      mockDbInsert.mockReturnValueOnce(buildInsertReturningChain([row]));
      // Second select call for pushUnreadCount
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([{ count: 1 }]));

      const service = await setupService();
      const result = await service.createNotification({
        userId: "user-1",
        type: "go_live",
        title: "Stream is live!",
        body: "Creator is streaming",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.id).toBe("notif-1");
      expect(result.value.type).toBe("go_live");
      expect(result.value.title).toBe("Stream is live!");
      expect(result.value.read).toBe(false);
      expect(result.value.createdAt).toBe("2026-04-01T10:00:00.000Z");
    });

    it("pushes WS unread count after insert", async () => {
      const row = makeNotificationRow();
      mockDbInsert.mockReturnValueOnce(buildInsertReturningChain([row]));
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([{ count: 3 }]));

      const service = await setupService();
      await service.createNotification({
        userId: "user-1",
        type: "go_live",
        title: "Live",
        body: "Content",
      });

      // Allow fire-and-forget to settle
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockSendToUser).toHaveBeenCalledWith("user-1", { type: "notification_count", count: 3 });
    });

    it("includes actionUrl when provided", async () => {
      const row = makeNotificationRow({ actionUrl: "/creators/alice" });
      mockDbInsert.mockReturnValueOnce(buildInsertReturningChain([row]));
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([{ count: 1 }]));

      const service = await setupService();
      const result = await service.createNotification({
        userId: "user-1",
        type: "go_live",
        title: "Live",
        body: "Content",
        actionUrl: "/creators/alice",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.actionUrl).toBe("/creators/alice");
    });
  });

  describe("getNotifications", () => {
    it("returns paginated notifications with hasMore=false when fewer than limit", async () => {
      const rows = [makeNotificationRow()];
      mockDbSelect.mockReturnValueOnce(buildSelectWhereOrderByLimitChain(rows));

      const service = await setupService();
      const result = await service.getNotifications({ userId: "user-1", limit: 20 });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.notifications).toHaveLength(1);
      expect(result.value.hasMore).toBe(false);
    });

    it("sets hasMore=true when results exceed limit", async () => {
      const rows = Array.from({ length: 21 }, (_, i) => makeNotificationRow({ id: `notif-${i}` }));
      mockDbSelect.mockReturnValueOnce(buildSelectWhereOrderByLimitChain(rows));

      const service = await setupService();
      const result = await service.getNotifications({ userId: "user-1", limit: 20 });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.notifications).toHaveLength(20);
      expect(result.value.hasMore).toBe(true);
    });

    it("applies before cursor when provided", async () => {
      const rows = [makeNotificationRow()];
      const fromMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rows),
          }),
        }),
      });
      mockDbSelect.mockReturnValueOnce({ from: fromMock });

      const service = await setupService();
      const result = await service.getNotifications({
        userId: "user-1",
        before: "2026-04-01T12:00:00.000Z",
        limit: 10,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.notifications).toHaveLength(1);
    });
  });

  describe("getUnreadCount", () => {
    it("returns unread count", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([{ count: 5 }]));

      const service = await setupService();
      const result = await service.getUnreadCount("user-1");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBe(5);
    });

    it("returns 0 when no unread notifications", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([{ count: 0 }]));

      const service = await setupService();
      const result = await service.getUnreadCount("user-1");

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBe(0);
    });
  });

  describe("markRead", () => {
    it("marks notification as read and pushes WS count", async () => {
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereReturningChain([{ id: "notif-1" }]));
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([{ count: 2 }]));

      const service = await setupService();
      const result = await service.markRead("user-1", "notif-1");

      expect(result.ok).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockSendToUser).toHaveBeenCalledWith("user-1", { type: "notification_count", count: 2 });
    });

    it("is idempotent when notification not found", async () => {
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereReturningChain([]));

      const service = await setupService();
      const result = await service.markRead("user-1", "nonexistent");

      expect(result.ok).toBe(true);
      // No WS push when no row was updated
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockSendToUser).not.toHaveBeenCalled();
    });
  });

  describe("markAllRead", () => {
    it("updates all unread and pushes WS count", async () => {
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereChain());
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([{ count: 0 }]));

      const service = await setupService();
      const result = await service.markAllRead("user-1");

      expect(result.ok).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockSendToUser).toHaveBeenCalledWith("user-1", { type: "notification_count", count: 0 });
    });
  });
});
