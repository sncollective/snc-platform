import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock State ──

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();
const mockCanModerateRoom = vi.fn();

// ── Setup Factory ──

const setupService = async () => {
  vi.doMock("../../src/db/connection.js", () => ({
    db: {
      select: mockDbSelect,
      insert: mockDbInsert,
      delete: mockDbDelete,
    },
    sql: vi.fn(),
  }));

  vi.doMock("../../src/db/schema/chat.schema.js", () => ({
    chatWordFilters: {
      id: "id",
      roomId: "roomId",
      pattern: "pattern",
      isRegex: "isRegex",
      createdAt: "createdAt",
    },
    chatRooms: {},
    chatMessages: {},
    chatModerationActions: {},
  }));

  vi.doMock("../../src/services/chat-moderation-auth.js", () => ({
    canModerateRoom: mockCanModerateRoom,
  }));

  return await import("../../src/services/chat-word-filters.js");
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

const buildSelectCountChain = (countValue: number) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([{ count: countValue }]),
  }),
});

const buildInsertReturningChain = (rows: unknown[]) => ({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(rows),
  }),
});

const buildDeleteWhereChain = () => ({
  where: vi.fn().mockResolvedValue([]),
});

// ── Fixtures ──

const makeFilterRow = (overrides?: Partial<{
  id: string;
  roomId: string;
  pattern: string;
  isRegex: boolean;
  createdAt: Date;
}>) => ({
  id: "filter-1",
  roomId: "room-1",
  pattern: "badword",
  isRegex: false,
  createdAt: new Date("2026-03-01T10:00:00Z"),
  ...overrides,
});

// ── Tests ──

describe("chat-word-filters service", () => {
  describe("addWordFilter", () => {
    it("creates a plain-text filter when authorized", async () => {
      mockCanModerateRoom.mockResolvedValue({ ok: true, value: true });
      const filterRow = makeFilterRow();

      mockDbSelect
        .mockReturnValueOnce(buildSelectWhereChain([])) // no duplicate
        .mockReturnValueOnce(buildSelectCountChain(0)); // under limit
      mockDbInsert.mockReturnValueOnce(buildInsertReturningChain([filterRow]));

      const { addWordFilter } = await setupService();
      const result = await addWordFilter({
        roomId: "room-1",
        moderatorUserId: "mod-1",
        pattern: "badword",
        isRegex: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pattern).toBe("badword");
        expect(result.value.isRegex).toBe(false);
      }
    });

    it("rejects invalid regex pattern", async () => {
      mockCanModerateRoom.mockResolvedValue({ ok: true, value: true });

      const { addWordFilter } = await setupService();
      const result = await addWordFilter({
        roomId: "room-1",
        moderatorUserId: "mod-1",
        pattern: "[invalid(regex",
        isRegex: true,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("rejects duplicate pattern", async () => {
      mockCanModerateRoom.mockResolvedValue({ ok: true, value: true });

      const existing = makeFilterRow();
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([existing])); // duplicate found

      const { addWordFilter } = await setupService();
      const result = await addWordFilter({
        roomId: "room-1",
        moderatorUserId: "mod-1",
        pattern: "badword",
        isRegex: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CONFLICT");
      }
    });

    it("rejects when room has reached 100 filter limit", async () => {
      mockCanModerateRoom.mockResolvedValue({ ok: true, value: true });

      mockDbSelect
        .mockReturnValueOnce(buildSelectWhereChain([])) // no duplicate
        .mockReturnValueOnce(buildSelectCountChain(100)); // at limit

      const { addWordFilter } = await setupService();
      const result = await addWordFilter({
        roomId: "room-1",
        moderatorUserId: "mod-1",
        pattern: "newword",
        isRegex: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("returns ForbiddenError when user lacks moderation authority", async () => {
      const { ForbiddenError } = await import("@snc/shared");
      mockCanModerateRoom.mockResolvedValue({
        ok: false,
        error: new ForbiddenError("Not authorized"),
      });

      const { addWordFilter } = await setupService();
      const result = await addWordFilter({
        roomId: "room-1",
        moderatorUserId: "user-1",
        pattern: "badword",
        isRegex: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("removeWordFilter", () => {
    it("removes existing filter when authorized", async () => {
      mockCanModerateRoom.mockResolvedValue({ ok: true, value: true });
      const filterRow = makeFilterRow();

      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([filterRow]));
      mockDbDelete.mockReturnValueOnce(buildDeleteWhereChain());

      const { removeWordFilter } = await setupService();
      const result = await removeWordFilter({
        filterId: "filter-1",
        moderatorUserId: "mod-1",
      });

      expect(result.ok).toBe(true);
    });

    it("returns NotFoundError for non-existent filter", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([]));

      const { removeWordFilter } = await setupService();
      const result = await removeWordFilter({
        filterId: "nonexistent",
        moderatorUserId: "mod-1",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("isMessageFiltered", () => {
    it("returns false when no filters exist", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([]));

      const { isMessageFiltered } = await setupService();
      const result = await isMessageFiltered("room-1", "hello world");

      expect(result).toBe(false);
    });

    it("returns true for case-insensitive plain-text match", async () => {
      const filter = makeFilterRow({ pattern: "BADWORD", isRegex: false });
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([filter]));

      const { isMessageFiltered } = await setupService();
      const result = await isMessageFiltered("room-1", "this has a badword in it");

      expect(result).toBe(true);
    });

    it("returns false when plain-text pattern does not match", async () => {
      const filter = makeFilterRow({ pattern: "badword", isRegex: false });
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([filter]));

      const { isMessageFiltered } = await setupService();
      const result = await isMessageFiltered("room-1", "this is clean content");

      expect(result).toBe(false);
    });

    it("returns true for regex pattern match", async () => {
      const filter = makeFilterRow({ pattern: "b[a4]d", isRegex: true });
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([filter]));

      const { isMessageFiltered } = await setupService();
      const result = await isMessageFiltered("room-1", "this is b4d content");

      expect(result).toBe(true);
    });

    it("returns false when regex pattern does not match", async () => {
      const filter = makeFilterRow({ pattern: "^only$", isRegex: true });
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([filter]));

      const { isMessageFiltered } = await setupService();
      const result = await isMessageFiltered("room-1", "this is not only");

      expect(result).toBe(false);
    });
  });
});
