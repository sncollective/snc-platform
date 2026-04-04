import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock State ──

const mockDbSelect = vi.fn();

// ── Setup Factory ──

const setupService = async () => {
  vi.doMock("../../src/db/connection.js", () => ({
    db: {
      select: mockDbSelect,
    },
    sql: vi.fn(),
  }));

  vi.doMock("../../src/db/schema/chat.schema.js", () => ({
    chatRooms: {
      id: "id",
      type: "type",
      channelId: "channelId",
      name: "name",
      slowModeSeconds: "slowModeSeconds",
      createdAt: "createdAt",
      closedAt: "closedAt",
    },
    chatModerationActions: {
      id: "id",
      roomId: "roomId",
      targetUserId: "targetUserId",
      action: "action",
      expiresAt: "expiresAt",
      createdAt: "createdAt",
    },
    chatWordFilters: {},
    chatMessages: {},
  }));

  vi.doMock("../../src/db/schema/user.schema.js", () => ({
    userRoles: {
      userId: "userId",
      role: "role",
    },
    users: {},
  }));

  vi.doMock("../../src/db/schema/creator.schema.js", () => ({
    creatorMembers: {
      userId: "userId",
      creatorId: "creatorId",
      role: "role",
    },
  }));

  vi.doMock("../../src/db/schema/streaming.schema.js", () => ({
    channels: {
      id: "id",
      creatorId: "creatorId",
    },
  }));

  return await import("../../src/services/chat-moderation-auth.js");
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

const buildSelectWhereOrderByChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue(rows),
    }),
  }),
});

const buildSelectWhereOrderByLimitChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  }),
});

// ── Fixtures ──

const platformRoom = {
  id: "room-1",
  type: "platform",
  channelId: null,
  name: "Community",
};

const channelRoom = {
  id: "room-2",
  type: "channel",
  channelId: "channel-1",
  name: "Stream Room",
};

// ── Tests ──

describe("chat-moderation-auth service", () => {
  describe("canModerateRoom", () => {
    it("returns ok(true) for admin user on platform room", async () => {
      mockDbSelect
        .mockReturnValueOnce(buildSelectWhereChain([platformRoom])) // load room
        .mockReturnValueOnce(buildSelectWhereChain([{ userId: "admin-1", role: "admin" }])); // admin role

      const { canModerateRoom } = await setupService();
      const result = await canModerateRoom("admin-1", "room-1");

      expect(result.ok).toBe(true);
    });

    it("returns ForbiddenError for non-admin on platform room", async () => {
      mockDbSelect
        .mockReturnValueOnce(buildSelectWhereChain([platformRoom])) // load room
        .mockReturnValueOnce(buildSelectWhereChain([])); // no admin role

      const { canModerateRoom } = await setupService();
      const result = await canModerateRoom("user-1", "room-1");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("returns ok(true) for admin on channel room", async () => {
      mockDbSelect
        .mockReturnValueOnce(buildSelectWhereChain([channelRoom])) // load room
        .mockReturnValueOnce(buildSelectWhereChain([{ userId: "admin-1", role: "admin" }])); // admin role

      const { canModerateRoom } = await setupService();
      const result = await canModerateRoom("admin-1", "room-2");

      expect(result.ok).toBe(true);
    });

    it("returns ok(true) for creator owner on their channel room", async () => {
      mockDbSelect
        .mockReturnValueOnce(buildSelectWhereChain([channelRoom])) // load room
        .mockReturnValueOnce(buildSelectWhereChain([])) // no admin role
        .mockReturnValueOnce(buildSelectWhereChain([{ creatorId: "creator-1" }])) // channel lookup
        .mockReturnValueOnce(buildSelectWhereChain([{ userId: "owner-1", creatorId: "creator-1", role: "owner" }])); // owner member

      const { canModerateRoom } = await setupService();
      const result = await canModerateRoom("owner-1", "room-2");

      expect(result.ok).toBe(true);
    });

    it("returns ForbiddenError for non-owner member on channel room", async () => {
      mockDbSelect
        .mockReturnValueOnce(buildSelectWhereChain([channelRoom])) // load room
        .mockReturnValueOnce(buildSelectWhereChain([])) // no admin role
        .mockReturnValueOnce(buildSelectWhereChain([{ creatorId: "creator-1" }])) // channel lookup
        .mockReturnValueOnce(buildSelectWhereChain([])); // not an owner member

      const { canModerateRoom } = await setupService();
      const result = await canModerateRoom("editor-1", "room-2");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });

    it("returns ForbiddenError for room not found", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereChain([])); // room not found

      const { canModerateRoom } = await setupService();
      const result = await canModerateRoom("user-1", "nonexistent");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("isUserBanned", () => {
    it("returns false when no moderation history", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereOrderByChain([]));

      const { isUserBanned } = await setupService();
      const result = await isUserBanned("user-1", "room-1");

      expect(result).toBe(false);
    });

    it("returns true when most recent ban/unban action is 'ban'", async () => {
      mockDbSelect.mockReturnValueOnce(
        buildSelectWhereOrderByChain([{ action: "ban" }, { action: "timeout" }]),
      );

      const { isUserBanned } = await setupService();
      const result = await isUserBanned("user-1", "room-1");

      expect(result).toBe(true);
    });

    it("returns false when most recent ban/unban action is 'unban'", async () => {
      mockDbSelect.mockReturnValueOnce(
        buildSelectWhereOrderByChain([{ action: "unban" }, { action: "ban" }]),
      );

      const { isUserBanned } = await setupService();
      const result = await isUserBanned("user-1", "room-1");

      expect(result).toBe(false);
    });
  });

  describe("isUserTimedOut", () => {
    it("returns not timed out when no timeout exists", async () => {
      mockDbSelect.mockReturnValueOnce(buildSelectWhereOrderByLimitChain([]));

      const { isUserTimedOut } = await setupService();
      const result = await isUserTimedOut("user-1", "room-1");

      expect(result.timedOut).toBe(false);
      expect(result.expiresAt).toBeNull();
    });

    it("returns timed out when timeout has not expired", async () => {
      const futureExpiry = new Date(Date.now() + 60000); // 1 minute from now
      mockDbSelect.mockReturnValueOnce(
        buildSelectWhereOrderByLimitChain([{ action: "timeout", expiresAt: futureExpiry }]),
      );

      const { isUserTimedOut } = await setupService();
      const result = await isUserTimedOut("user-1", "room-1");

      expect(result.timedOut).toBe(true);
      expect(result.expiresAt).toBe(futureExpiry.toISOString());
    });

    it("returns not timed out when timeout has expired", async () => {
      const pastExpiry = new Date(Date.now() - 60000); // 1 minute ago
      mockDbSelect.mockReturnValueOnce(
        buildSelectWhereOrderByLimitChain([{ action: "timeout", expiresAt: pastExpiry }]),
      );

      const { isUserTimedOut } = await setupService();
      const result = await isUserTimedOut("user-1", "room-1");

      expect(result.timedOut).toBe(false);
      expect(result.expiresAt).toBeNull();
    });
  });
});
