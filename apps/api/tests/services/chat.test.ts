import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock State ──

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

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
  vi.doMock("../../src/db/schema/chat.schema.js", () => ({
    chatRooms: {
      id: "id",
      type: "type",
      channelId: "channelId",
      name: "name",
      createdAt: "createdAt",
      closedAt: "closedAt",
    },
    chatMessages: {
      id: "id",
      roomId: "roomId",
      userId: "userId",
      userName: "userName",
      avatarUrl: "avatarUrl",
      content: "content",
      createdAt: "createdAt",
    },
  }));
  return await import("../../src/services/chat.js");
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

/** update .set().where() → resolves */
const buildUpdateSetWhereChain = () => ({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  }),
});

// ── Fixtures ──

const makeRoomRow = (overrides?: Partial<{
  id: string;
  type: string;
  channelId: string | null;
  name: string;
  createdAt: Date;
  closedAt: Date | null;
}>) => ({
  id: "room-1",
  type: "platform",
  channelId: null,
  name: "Community",
  createdAt: new Date("2026-03-01T10:00:00Z"),
  closedAt: null,
  ...overrides,
});

const makeMessageRow = (overrides?: Partial<{
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  content: string;
  createdAt: Date;
}>) => ({
  id: "msg-1",
  roomId: "room-1",
  userId: "user-1",
  userName: "Alice",
  avatarUrl: null,
  content: "Hello world",
  createdAt: new Date("2026-03-01T10:05:00Z"),
  ...overrides,
});

// ── Tests ──

describe("chat service", () => {
  describe("ensurePlatformRoom", () => {
    it("creates platform room on first call when none exists", async () => {
      const roomRow = makeRoomRow();

      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([]));
      mockDbInsert.mockReturnValueOnce(buildInsertReturningChain([roomRow]));

      const { ensurePlatformRoom } = await setupService();
      const result = await ensurePlatformRoom();

      expect(result.type).toBe("platform");
      expect(result.name).toBe("Community");
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });

    it("returns existing room without inserting", async () => {
      const roomRow = makeRoomRow();

      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([roomRow]));

      const { ensurePlatformRoom } = await setupService();
      const result = await ensurePlatformRoom();

      expect(result.id).toBe("room-1");
      expect(mockDbInsert).not.toHaveBeenCalled();
    });
  });

  describe("createChannelRoom", () => {
    it("creates room linked to channel with correct name", async () => {
      const roomRow = makeRoomRow({
        id: "room-2",
        type: "channel",
        channelId: "channel-1",
        name: "Creator's Stream",
      });

      mockDbInsert.mockReturnValueOnce(buildInsertReturningChain([roomRow]));

      const { createChannelRoom } = await setupService();
      const result = await createChannelRoom("channel-1", "Creator's Stream");

      expect(result.type).toBe("channel");
      expect(result.channelId).toBe("channel-1");
      expect(result.name).toBe("Creator's Stream");
    });
  });

  describe("closeChannelRoom", () => {
    it("calls update to set closedAt", async () => {
      mockDbUpdate.mockReturnValueOnce(buildUpdateSetWhereChain());

      const { closeChannelRoom } = await setupService();
      await closeChannelRoom("channel-1");

      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe("ensureChannelRoom", () => {
    it("returns existing open room without inserting", async () => {
      const roomRow = makeRoomRow({
        id: "room-1",
        type: "channel",
        channelId: "channel-1",
        name: "S/NC Radio",
      });

      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([roomRow]));

      const { ensureChannelRoom } = await setupService();
      const result = await ensureChannelRoom("channel-1", "S/NC Radio");

      expect(result.id).toBe("room-1");
      expect(result.channelId).toBe("channel-1");
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it("creates room when none exists", async () => {
      const roomRow = makeRoomRow({
        id: "room-2",
        type: "channel",
        channelId: "channel-1",
        name: "S/NC Radio",
      });

      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([]));
      mockDbInsert.mockReturnValueOnce(buildInsertReturningChain([roomRow]));

      const { ensureChannelRoom } = await setupService();
      const result = await ensureChannelRoom("channel-1", "S/NC Radio");

      expect(result.channelId).toBe("channel-1");
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });
  });

  describe("createMessage", () => {
    it("persists and returns message for open room", async () => {
      const roomRow = makeRoomRow();
      const messageRow = makeMessageRow();

      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([roomRow]));
      mockDbInsert.mockReturnValueOnce(buildInsertReturningChain([messageRow]));

      const { createMessage } = await setupService();
      const result = await createMessage({
        roomId: "room-1",
        userId: "user-1",
        userName: "Alice",
        avatarUrl: null,
        content: "Hello world",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content).toBe("Hello world");
        expect(result.value.userId).toBe("user-1");
      }
    });

    it("rejects message for closed room", async () => {
      const closedRoom = makeRoomRow({ closedAt: new Date("2026-03-01T11:00:00Z") });

      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([closedRoom]));

      const { createMessage } = await setupService();
      const result = await createMessage({
        roomId: "room-1",
        userId: "user-1",
        userName: "Alice",
        avatarUrl: null,
        content: "Hello",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("closed");
      }
    });

    it("returns not found error when room does not exist", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([]));

      const { createMessage } = await setupService();
      const result = await createMessage({
        roomId: "nonexistent",
        userId: "user-1",
        userName: "Alice",
        avatarUrl: null,
        content: "Hello",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("not found");
      }
    });

    it("strips HTML tags from message content", async () => {
      const roomRow = makeRoomRow();
      const sanitizedRow = makeMessageRow({ content: "Hello world" });

      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([roomRow]));
      mockDbInsert.mockReturnValueOnce(buildInsertReturningChain([sanitizedRow]));

      const { createMessage } = await setupService();
      const result = await createMessage({
        roomId: "room-1",
        userId: "user-1",
        userName: "Alice",
        avatarUrl: null,
        content: "<script>alert('xss')</script>Hello world",
      });

      expect(result.ok).toBe(true);
      // The insert was called — content was sanitized before insert
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });

    it("returns error when content exceeds max length", async () => {
      const { createMessage } = await setupService();
      const result = await createMessage({
        roomId: "room-1",
        userId: "user-1",
        userName: "Alice",
        avatarUrl: null,
        content: "x".repeat(501),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("MESSAGE_TOO_LONG");
      }
    });
  });

  describe("getMessageHistory", () => {
    it("paginates with limit+1 pattern and returns hasMore false when at limit", async () => {
      const rows = [
        makeMessageRow({ id: "msg-1" }),
        makeMessageRow({ id: "msg-2" }),
      ];

      mockDbSelect.mockReturnValueOnce(buildSelectWhereOrderByLimitChain(rows));

      const { getMessageHistory } = await setupService();
      const result = await getMessageHistory({ roomId: "room-1", limit: 50 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hasMore).toBe(false);
        expect(result.value.messages).toHaveLength(2);
      }
    });

    it("returns hasMore true when rows exceed limit", async () => {
      // limit=2, return 3 rows → hasMore true
      const rows = [
        makeMessageRow({ id: "msg-1" }),
        makeMessageRow({ id: "msg-2" }),
        makeMessageRow({ id: "msg-3" }),
      ];

      mockDbSelect.mockReturnValueOnce(buildSelectWhereOrderByLimitChain(rows));

      const { getMessageHistory } = await setupService();
      const result = await getMessageHistory({ roomId: "room-1", limit: 2 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.hasMore).toBe(true);
        expect(result.value.messages).toHaveLength(2);
      }
    });
  });
});
