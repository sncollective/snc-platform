import { describe, it, expect, vi, afterEach } from "vitest";

// ── Module Setup ──

const setupModule = async () => {
  // For resolveAudience: two separate innerJoin queries, each ending in .where()
  // followers: select().from().innerJoin(users).where()
  // subscribers: select().from().innerJoin(users).innerJoin(subscriptionPlans).where()

  const mockFollowersWhere = vi.fn().mockResolvedValue([]);
  const mockFollowersInnerJoin = vi.fn(() => ({ where: mockFollowersWhere }));

  const mockSubscribersWhere = vi.fn().mockResolvedValue([]);
  const mockSubscribersSecondInnerJoin = vi.fn(() => ({ where: mockSubscribersWhere }));
  const mockSubscribersFirstInnerJoin = vi.fn(() => ({
    innerJoin: mockSubscribersSecondInnerJoin,
  }));

  let selectCallCount = 0;
  const mockSelectFrom = vi.fn(() => {
    selectCallCount++;
    if (selectCallCount === 1) {
      // Followers query
      return { innerJoin: mockFollowersInnerJoin, where: mockSelectWhere };
    } else {
      // Subscribers query
      return { innerJoin: mockSubscribersFirstInnerJoin, where: mockSelectWhere };
    }
  });
  const mockSelectWhere = vi.fn().mockResolvedValue([]);
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

  const mockInsertOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const mockInsertValues = vi.fn(() => ({ onConflictDoNothing: mockInsertOnConflictDoNothing }));
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

  const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

  const mockDb = {
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
  };

  vi.doMock("../../src/config.js", () => ({ config: {} }));
  vi.doMock("../../src/db/connection.js", () => ({ db: mockDb }));
  vi.doMock("../../src/db/schema/notification.schema.js", () => ({
    creatorFollows: { userId: {}, creatorId: {} },
  }));
  vi.doMock("../../src/db/schema/subscription.schema.js", () => ({
    userSubscriptions: { userId: {}, planId: {}, status: {} },
    subscriptionPlans: { id: {}, creatorId: {} },
  }));
  vi.doMock("../../src/db/schema/user.schema.js", () => ({
    users: { id: {}, email: {}, name: {} },
  }));

  const module = await import("../../src/services/follows.js");

  return {
    ...module,
    mockInsert,
    mockInsertOnConflictDoNothing,
    mockDelete,
    mockDeleteWhere,
    mockSelect,
    mockSelectWhere,
    mockFollowersWhere,
    mockSubscribersWhere,
    selectCallCount: () => selectCallCount,
    resetSelectCount: () => { selectCallCount = 0; },
  };
};

// ── Tests ──

afterEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

describe("follows service", () => {
  describe("followCreator", () => {
    it("inserts a follow row with onConflictDoNothing", async () => {
      const { followCreator, mockInsert, mockInsertOnConflictDoNothing } = await setupModule();

      const result = await followCreator("user-1", "creator-1");

      expect(result.ok).toBe(true);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsertOnConflictDoNothing).toHaveBeenCalled();
    });

    it("is idempotent — returns ok even on conflict (no-op)", async () => {
      const { followCreator, mockInsertOnConflictDoNothing } = await setupModule();
      mockInsertOnConflictDoNothing.mockResolvedValueOnce(undefined);

      const result = await followCreator("user-1", "creator-1");

      expect(result.ok).toBe(true);
    });
  });

  describe("unfollowCreator", () => {
    it("deletes the follow row", async () => {
      const { unfollowCreator, mockDelete, mockDeleteWhere } = await setupModule();

      const result = await unfollowCreator("user-1", "creator-1");

      expect(result.ok).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("is idempotent — returns ok even when not following", async () => {
      const { unfollowCreator, mockDeleteWhere } = await setupModule();
      mockDeleteWhere.mockResolvedValueOnce(undefined);

      const result = await unfollowCreator("user-1", "creator-1");

      expect(result.ok).toBe(true);
    });
  });

  describe("getFollowStatus", () => {
    it("returns follower count and isFollowing true when following", async () => {
      const { getFollowStatus, mockSelectWhere } = await setupModule();
      // First call: count query result
      mockSelectWhere.mockResolvedValueOnce([{ count: 5 }]);
      // Second call: follow check
      mockSelectWhere.mockResolvedValueOnce([{ userId: "user-1", creatorId: "creator-1" }]);

      const status = await getFollowStatus("user-1", "creator-1");

      expect(status.followerCount).toBe(5);
      expect(status.isFollowing).toBe(true);
    });

    it("returns isFollowing false when user is not following", async () => {
      const { getFollowStatus, mockSelectWhere } = await setupModule();
      mockSelectWhere.mockResolvedValueOnce([{ count: 3 }]);
      mockSelectWhere.mockResolvedValueOnce([]);

      const status = await getFollowStatus("user-1", "creator-1");

      expect(status.isFollowing).toBe(false);
      expect(status.followerCount).toBe(3);
    });

    it("skips follow check for anonymous user", async () => {
      const { getFollowStatus, mockSelectWhere } = await setupModule();
      mockSelectWhere.mockResolvedValueOnce([{ count: 2 }]);

      const status = await getFollowStatus(null, "creator-1");

      expect(status.isFollowing).toBe(false);
      expect(status.followerCount).toBe(2);
      // Only the count query, no follow check
      expect(mockSelectWhere).toHaveBeenCalledTimes(1);
    });

    it("handles missing count row gracefully", async () => {
      const { getFollowStatus, mockSelectWhere } = await setupModule();
      mockSelectWhere.mockResolvedValueOnce([]);

      const status = await getFollowStatus(null, "creator-1");

      expect(status.followerCount).toBe(0);
    });
  });

  describe("resolveAudience", () => {
    it("returns combined followers and subscribers deduplicated", async () => {
      const { resolveAudience, mockFollowersWhere, mockSubscribersWhere } = await setupModule();

      mockFollowersWhere.mockResolvedValueOnce([
        { userId: "user-1", email: "a@test.com", name: "Alice" },
      ]);
      mockSubscribersWhere.mockResolvedValueOnce([
        { userId: "user-2", email: "b@test.com", name: "Bob" },
        { userId: "user-1", email: "a@test.com", name: "Alice" }, // duplicate
      ]);

      const audience = await resolveAudience("creator-1");

      expect(audience).toHaveLength(2);
      const ids = audience.map((m) => m.userId);
      expect(ids).toContain("user-1");
      expect(ids).toContain("user-2");
    });

    it("returns empty array when no followers or subscribers", async () => {
      const { resolveAudience, mockFollowersWhere, mockSubscribersWhere } = await setupModule();

      mockFollowersWhere.mockResolvedValueOnce([]);
      mockSubscribersWhere.mockResolvedValueOnce([]);

      const audience = await resolveAudience("creator-1");

      expect(audience).toHaveLength(0);
    });
  });
});
