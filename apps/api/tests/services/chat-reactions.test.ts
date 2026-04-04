import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock State ──

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();
const mockIsUserBanned = vi.fn();

// ── Setup Factory ──

const setupService = async () => {
  vi.doMock("../../src/db/connection.js", () => ({
    db: {
      select: mockDbSelect,
      insert: mockDbInsert,
      delete: mockDbDelete,
    },
  }));
  vi.doMock("../../src/db/schema/chat.schema.js", () => ({
    chatRooms: {
      id: "id",
      closedAt: "closedAt",
    },
    chatMessages: {
      id: "id",
      roomId: "roomId",
    },
    chatMessageReactions: {
      id: "id",
      messageId: "messageId",
      userId: "userId",
      roomId: "roomId",
      emoji: "emoji",
      createdAt: "createdAt",
    },
  }));
  vi.doMock("../../src/services/chat-moderation-auth.js", () => ({
    isUserBanned: mockIsUserBanned,
  }));
  return await import("../../src/services/chat-reactions.js");
};

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

// ── DB Chain Helpers ──

const buildSelectWhereChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(rows),
  }),
});

const buildInsertOnConflictChain = () => ({
  values: vi.fn().mockReturnValue({
    onConflictDoNothing: vi.fn().mockResolvedValue([]),
  }),
});

const buildDeleteWhereChain = () => ({
  where: vi.fn().mockResolvedValue([]),
});

// ── Tests ──

describe("chat-reactions service", () => {
  describe("addReaction", () => {
    it("inserts and returns count 1 for a new reaction", async () => {
      const { addReaction } = await setupService();

      // room query → room found, not closed
      // message query → message found
      // insert → no-op
      // reaction count query → 1 row
      mockDbSelect
        .mockReturnValueOnce(buildSelectWhereChain([{ closedAt: null }]))
        .mockReturnValueOnce(buildSelectWhereChain([{ id: "msg-1" }]))
        .mockReturnValueOnce(buildSelectWhereChain([{ userId: "user-1" }]));
      mockDbInsert.mockReturnValueOnce(buildInsertOnConflictChain());
      mockIsUserBanned.mockResolvedValue(false);

      const result = await addReaction({
        messageId: "msg-1",
        roomId: "room-1",
        userId: "user-1",
        emoji: "👍",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.count).toBe(1);
        expect(result.value.userIds).toEqual(["user-1"]);
      }
    });

    it("is idempotent — second call returns same count without error", async () => {
      const { addReaction } = await setupService();

      // Both calls: room found, message found, insert (no-op for second), count = 1
      mockDbSelect
        .mockReturnValueOnce(buildSelectWhereChain([{ closedAt: null }]))
        .mockReturnValueOnce(buildSelectWhereChain([{ id: "msg-1" }]))
        .mockReturnValueOnce(buildSelectWhereChain([{ userId: "user-1" }]));
      mockDbInsert.mockReturnValue(buildInsertOnConflictChain());
      mockIsUserBanned.mockResolvedValue(false);

      const result = await addReaction({
        messageId: "msg-1",
        roomId: "room-1",
        userId: "user-1",
        emoji: "👍",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.count).toBe(1);
      }
    });

    it("returns count 2 when two different users react with same emoji", async () => {
      const { addReaction } = await setupService();

      mockDbSelect
        .mockReturnValueOnce(buildSelectWhereChain([{ closedAt: null }]))
        .mockReturnValueOnce(buildSelectWhereChain([{ id: "msg-1" }]))
        .mockReturnValueOnce(buildSelectWhereChain([{ userId: "user-1" }, { userId: "user-2" }]));
      mockDbInsert.mockReturnValueOnce(buildInsertOnConflictChain());
      mockIsUserBanned.mockResolvedValue(false);

      const result = await addReaction({
        messageId: "msg-1",
        roomId: "room-1",
        userId: "user-2",
        emoji: "👍",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.count).toBe(2);
        expect(result.value.userIds).toContain("user-1");
        expect(result.value.userIds).toContain("user-2");
      }
    });

    it("returns ForbiddenError for banned user", async () => {
      const { addReaction } = await setupService();

      mockDbSelect
        .mockReturnValueOnce(buildSelectWhereChain([{ closedAt: null }]))
        .mockReturnValueOnce(buildSelectWhereChain([{ id: "msg-1" }]));
      mockIsUserBanned.mockResolvedValue(true);

      const result = await addReaction({
        messageId: "msg-1",
        roomId: "room-1",
        userId: "user-1",
        emoji: "👍",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("returns ForbiddenError for closed room", async () => {
      const { addReaction } = await setupService();

      mockDbSelect
        .mockReturnValueOnce(buildSelectWhereChain([{ closedAt: new Date() }]));
      mockIsUserBanned.mockResolvedValue(false);

      const result = await addReaction({
        messageId: "msg-1",
        roomId: "room-1",
        userId: "user-1",
        emoji: "👍",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("returns NotFoundError for unknown messageId", async () => {
      const { addReaction } = await setupService();

      mockDbSelect
        .mockReturnValueOnce(buildSelectWhereChain([{ closedAt: null }]))
        .mockReturnValueOnce(buildSelectWhereChain([]));
      mockIsUserBanned.mockResolvedValue(false);

      const result = await addReaction({
        messageId: "nonexistent",
        roomId: "room-1",
        userId: "user-1",
        emoji: "👍",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("removeReaction", () => {
    it("deletes the row and returns updated count", async () => {
      const { removeReaction } = await setupService();

      mockDbSelect
        .mockReturnValueOnce(buildSelectWhereChain([{ id: "room-1" }]))
        .mockReturnValueOnce(buildSelectWhereChain([]));
      mockDbDelete.mockReturnValueOnce(buildDeleteWhereChain());

      const result = await removeReaction({
        messageId: "msg-1",
        roomId: "room-1",
        userId: "user-1",
        emoji: "👍",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.count).toBe(0);
        expect(result.value.userIds).toEqual([]);
      }
    });

    it("is idempotent — removing non-existent reaction returns count 0, no error", async () => {
      const { removeReaction } = await setupService();

      mockDbSelect
        .mockReturnValueOnce(buildSelectWhereChain([{ id: "room-1" }]))
        .mockReturnValueOnce(buildSelectWhereChain([]));
      mockDbDelete.mockReturnValueOnce(buildDeleteWhereChain());

      const result = await removeReaction({
        messageId: "msg-1",
        roomId: "room-1",
        userId: "user-1",
        emoji: "👍",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.count).toBe(0);
      }
    });
  });

  describe("getReactionsBatch", () => {
    it("returns empty object for empty messageIds", async () => {
      const { getReactionsBatch } = await setupService();

      const result = await getReactionsBatch([], null);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({});
      }
    });

    it("groups correctly across multiple messages and emojis", async () => {
      const { getReactionsBatch } = await setupService();

      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { messageId: "msg-1", emoji: "👍", userId: "user-1" },
            { messageId: "msg-1", emoji: "👍", userId: "user-2" },
            { messageId: "msg-1", emoji: "❤️", userId: "user-1" },
            { messageId: "msg-2", emoji: "😂", userId: "user-3" },
          ]),
        }),
      });

      const result = await getReactionsBatch(["msg-1", "msg-2"], null);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const msg1 = result.value["msg-1"];
        const msg2 = result.value["msg-2"];
        expect(msg1).toBeDefined();
        expect(msg2).toBeDefined();

        const thumbsUp = msg1?.find((r) => r.emoji === "👍");
        expect(thumbsUp?.count).toBe(2);

        const heart = msg1?.find((r) => r.emoji === "❤️");
        expect(heart?.count).toBe(1);

        const laugh = msg2?.find((r) => r.emoji === "😂");
        expect(laugh?.count).toBe(1);
      }
    });

    it("sets reactedByMe: true for matching userId", async () => {
      const { getReactionsBatch } = await setupService();

      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { messageId: "msg-1", emoji: "👍", userId: "user-1" },
            { messageId: "msg-1", emoji: "👍", userId: "user-2" },
          ]),
        }),
      });

      const result = await getReactionsBatch(["msg-1"], "user-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        const thumbsUp = result.value["msg-1"]?.find((r) => r.emoji === "👍");
        expect(thumbsUp?.reactedByMe).toBe(true);
      }
    });
  });
});
