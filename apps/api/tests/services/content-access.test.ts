import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { Visibility } from "@snc/shared";

import { TEST_CONFIG } from "../helpers/test-constants.js";

// ── Mock State ──

// SELECT chain for innerJoin path: db.select().from().innerJoin().where().limit()
const mockLimit = vi.fn();
const mockSelectWhere = vi.fn(() => ({ limit: mockLimit }));
const mockInnerJoin = vi.fn(() => ({ where: mockSelectWhere }));

// SELECT chain for direct where path: db.select().from().where()
// Used by creatorMembers queries (no innerJoin)
const mockMemberWhere = vi.fn();

const mockSelectFrom = vi.fn(() => ({
  innerJoin: mockInnerJoin,
  where: mockMemberWhere,
}));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

const mockDb = {
  select: mockSelect,
};

const mockGetUserRoles = vi.fn();

// ── Test App Factory ──

const setupContentGate = async () => {
  vi.doMock("../../src/config.js", () => ({
    config: TEST_CONFIG,
  }));

  vi.doMock("../../src/db/connection.js", () => ({
    db: mockDb,
    sql: vi.fn(),
  }));

  vi.doMock("../../src/auth/user-roles.js", () => ({
    getUserRoles: mockGetUserRoles,
  }));

  vi.doMock("../../src/db/schema/subscription.schema.js", () => ({
    subscriptionPlans: {
      id: {},
      type: {},
      creatorId: {},
    },
    userSubscriptions: {
      id: {},
      userId: {},
      planId: {},
      status: {},
      currentPeriodEnd: {},
    },
  }));

  vi.doMock("../../src/db/schema/creator.schema.js", () => ({
    creatorMembers: {
      userId: {},
      creatorId: {},
      role: {},
    },
  }));

  return await import("../../src/services/content-access.js");
};

// ── Tests ──

describe("checkContentAccess", () => {
  let checkContentAccess: (
    userId: string | null,
    contentCreatorId: string,
    contentVisibility: Visibility,
    prefetchedRoles?: string[],
  ) => Promise<{ allowed: boolean; reason?: string; creatorId?: string }>;

  beforeEach(async () => {
    // Default: no matching subscriptions found, no roles, not a team member
    mockLimit.mockResolvedValue([]);
    mockMemberWhere.mockResolvedValue([]);
    mockGetUserRoles.mockResolvedValue(["subscriber"]);
    const mod = await setupContentGate();
    checkContentAccess = mod.checkContentAccess;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("public content", () => {
    it("returns allowed for public visibility without querying DB", async () => {
      const result = await checkContentAccess("user_123", "creator_456", "public");

      expect(result).toEqual({ allowed: true });
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });

  describe("unauthenticated access", () => {
    it("returns not allowed with AUTHENTICATION_REQUIRED for null userId", async () => {
      const result = await checkContentAccess(null, "creator_456", "subscribers");

      expect(result).toEqual({
        allowed: false,
        reason: "AUTHENTICATION_REQUIRED",
        creatorId: "creator_456",
      });
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });

  describe("creator team member bypass", () => {
    it("returns allowed when user is a team member of the creator", async () => {
      mockMemberWhere.mockResolvedValueOnce([{ role: "owner" }]);

      const result = await checkContentAccess("creator_456", "creator_456", "subscribers");

      expect(result).toEqual({ allowed: true });
      // Subscription check should not be reached
      expect(mockLimit).not.toHaveBeenCalled();
    });

    it("falls through when user is not a team member", async () => {
      // mockMemberWhere defaults to [] (not a member)
      mockLimit.mockResolvedValue([]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({
        allowed: false,
        reason: "SUBSCRIPTION_REQUIRED",
        creatorId: "creator_456",
      });
    });
  });

  describe("creator role bypass", () => {
    it("returns allowed when user has creator role", async () => {
      mockGetUserRoles.mockResolvedValue(["creator"]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({ allowed: true });
      expect(mockLimit).not.toHaveBeenCalled();
    });

    it("skips subscription check when user has creator role", async () => {
      mockGetUserRoles.mockResolvedValue(["subscriber", "creator"]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({ allowed: true });
      expect(mockLimit).not.toHaveBeenCalled();
    });

    it("falls through to subscription check when user lacks creator role", async () => {
      mockGetUserRoles.mockResolvedValue(["subscriber"]);
      mockLimit.mockResolvedValue([]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({
        allowed: false,
        reason: "SUBSCRIPTION_REQUIRED",
        creatorId: "creator_456",
      });
    });
  });

  describe("active platform subscription", () => {
    it("returns allowed when user has active platform subscription", async () => {
      mockLimit.mockResolvedValue([{ id: "sub_123" }]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({ allowed: true });
      expect(mockLimit).toHaveBeenCalledOnce();
    });
  });

  describe("active per-creator subscription", () => {
    it("returns allowed when user has active subscription for matching creator", async () => {
      mockLimit.mockResolvedValue([{ id: "sub_123" }]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({ allowed: true });
    });

    it("returns not allowed when user has active subscription for different creator", async () => {
      mockLimit.mockResolvedValue([]);

      const result = await checkContentAccess("user_123", "creator_other", "subscribers");

      expect(result).toEqual({
        allowed: false,
        reason: "SUBSCRIPTION_REQUIRED",
        creatorId: "creator_other",
      });
    });
  });

  describe("canceled subscription", () => {
    it("returns allowed when canceled but currentPeriodEnd is in the future", async () => {
      // DB query includes canceled + future period in WHERE clause; if it
      // matches, the mock returns a row indicating access is granted
      mockLimit.mockResolvedValue([{ id: "sub_123" }]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({ allowed: true });
    });

    it("returns not allowed when canceled and currentPeriodEnd is in the past", async () => {
      // DB query excludes expired canceled subscriptions; mock returns empty
      mockLimit.mockResolvedValue([]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({
        allowed: false,
        reason: "SUBSCRIPTION_REQUIRED",
        creatorId: "creator_456",
      });
    });
  });

  describe("past_due subscription", () => {
    it("returns not allowed when subscription is past_due", async () => {
      // past_due is excluded from the query's status filter; mock returns empty
      mockLimit.mockResolvedValue([]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({
        allowed: false,
        reason: "SUBSCRIPTION_REQUIRED",
        creatorId: "creator_456",
      });
    });
  });

  describe("no subscription", () => {
    it("returns not allowed when user has no subscriptions", async () => {
      mockLimit.mockResolvedValue([]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({
        allowed: false,
        reason: "SUBSCRIPTION_REQUIRED",
        creatorId: "creator_456",
      });
    });
  });

  describe("pre-fetched roles", () => {
    it("uses prefetchedRoles instead of querying getUserRoles", async () => {
      mockLimit.mockResolvedValue([]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers", ["subscriber"]);

      expect(result).toEqual({
        allowed: false,
        reason: "SUBSCRIPTION_REQUIRED",
        creatorId: "creator_456",
      });
      expect(mockGetUserRoles).not.toHaveBeenCalled();
    });

    it("returns allowed when prefetchedRoles includes creator", async () => {
      const result = await checkContentAccess("user_123", "creator_456", "subscribers", ["creator"]);

      expect(result).toEqual({ allowed: true });
      expect(mockGetUserRoles).not.toHaveBeenCalled();
      expect(mockLimit).not.toHaveBeenCalled();
    });

    it("falls back to getUserRoles when prefetchedRoles is undefined", async () => {
      mockGetUserRoles.mockResolvedValue(["subscriber"]);
      mockLimit.mockResolvedValue([]);

      await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(mockGetUserRoles).toHaveBeenCalledWith("user_123");
    });
  });
});

describe("buildContentAccessContext", () => {
  let buildContentAccessContext: (
    userId: string | null,
    prefetchedRoles?: string[],
  ) => Promise<{
    userId: string | null;
    roles: string[];
    memberCreatorIds: Set<string>;
    subscribedCreatorIds: Set<string>;
    hasPlatformSubscription: boolean;
  }>;

  beforeEach(async () => {
    mockLimit.mockResolvedValue([]);
    mockMemberWhere.mockResolvedValue([]);
    mockGetUserRoles.mockResolvedValue(["subscriber"]);
    const mod = await setupContentGate();
    buildContentAccessContext = mod.buildContentAccessContext;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns empty context for null userId without any queries", async () => {
    const ctx = await buildContentAccessContext(null);

    expect(ctx.userId).toBeNull();
    expect(ctx.roles).toEqual([]);
    expect(ctx.hasPlatformSubscription).toBe(false);
    expect(ctx.subscribedCreatorIds.size).toBe(0);
    expect(mockGetUserRoles).not.toHaveBeenCalled();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("skips subscription query for creator role", async () => {
    mockGetUserRoles.mockResolvedValue(["creator"]);

    const ctx = await buildContentAccessContext("user_123");

    expect(ctx.userId).toBe("user_123");
    expect(ctx.roles).toContain("creator");
    expect(ctx.hasPlatformSubscription).toBe(true);
    expect(mockSelectWhere).not.toHaveBeenCalled();
  });

  it("fetches subscriptions for subscriber role", async () => {
    mockGetUserRoles.mockResolvedValue(["subscriber"]);
    // The batch query has no .limit() — it uses the innerJoin → where chain directly
    mockSelectWhere.mockResolvedValue([
      { planType: "platform", planCreatorId: null },
      { planType: "creator", planCreatorId: "creator_A" },
    ]);

    const ctx = await buildContentAccessContext("user_123");

    expect(ctx.userId).toBe("user_123");
    expect(ctx.hasPlatformSubscription).toBe(true);
    expect(ctx.subscribedCreatorIds.has("creator_A")).toBe(true);
    expect(mockSelect).toHaveBeenCalled();
  });

  it("returns no platform subscription when only creator subscriptions exist", async () => {
    mockGetUserRoles.mockResolvedValue(["subscriber"]);
    mockSelectWhere.mockResolvedValue([
      { planType: "creator", planCreatorId: "creator_B" },
    ]);

    const ctx = await buildContentAccessContext("user_123");

    expect(ctx.hasPlatformSubscription).toBe(false);
    expect(ctx.subscribedCreatorIds.has("creator_B")).toBe(true);
  });

  it("uses prefetchedRoles instead of querying getUserRoles", async () => {
    mockSelectWhere.mockResolvedValue([]);

    const ctx = await buildContentAccessContext("user_123", ["subscriber"]);

    expect(ctx.roles).toEqual(["subscriber"]);
    expect(mockGetUserRoles).not.toHaveBeenCalled();
    expect(mockSelect).toHaveBeenCalled();
  });

  it("skips subscription query for prefetched creator role", async () => {
    const ctx = await buildContentAccessContext("user_123", ["creator"]);

    expect(ctx.roles).toContain("creator");
    expect(ctx.hasPlatformSubscription).toBe(true);
    expect(mockGetUserRoles).not.toHaveBeenCalled();
    expect(mockSelectWhere).not.toHaveBeenCalled();
  });

  it("ignores prefetchedRoles for null userId", async () => {
    const ctx = await buildContentAccessContext(null, ["creator"]);

    expect(ctx.userId).toBeNull();
    expect(ctx.roles).toEqual([]);
    expect(mockGetUserRoles).not.toHaveBeenCalled();
  });
});

describe("hasContentAccess", () => {
  let hasContentAccess: (
    ctx: {
      userId: string | null;
      roles: string[];
      memberCreatorIds: Set<string>;
      subscribedCreatorIds: Set<string>;
      hasPlatformSubscription: boolean;
    },
    contentCreatorId: string,
    contentVisibility: Visibility,
  ) => boolean;

  beforeEach(async () => {
    mockLimit.mockResolvedValue([]);
    mockMemberWhere.mockResolvedValue([]);
    mockGetUserRoles.mockResolvedValue(["subscriber"]);
    const mod = await setupContentGate();
    hasContentAccess = mod.hasContentAccess;
  });

  afterEach(() => {
    vi.resetModules();
  });

  const baseCtx = {
    userId: "user_123",
    roles: ["subscriber"],
    memberCreatorIds: new Set<string>(),
    subscribedCreatorIds: new Set<string>(),
    hasPlatformSubscription: false,
  };

  it("allows public content for any context", () => {
    const ctx = { ...baseCtx, userId: null, roles: [] };
    expect(hasContentAccess(ctx, "creator_456", "public")).toBe(true);
  });

  it("denies unauthenticated user for subscriber content", () => {
    const ctx = { ...baseCtx, userId: null, roles: [] };
    expect(hasContentAccess(ctx, "creator_456", "subscribers")).toBe(false);
  });

  it("allows content creator (owner bypass via memberCreatorIds)", () => {
    const ctx = { ...baseCtx, memberCreatorIds: new Set(["user_123"]) };
    expect(hasContentAccess(ctx, "user_123", "subscribers")).toBe(true);
  });

  it("allows user with creator role", () => {
    const ctx = { ...baseCtx, roles: ["creator"] };
    expect(hasContentAccess(ctx, "creator_456", "subscribers")).toBe(true);
  });

  it("allows user with platform subscription", () => {
    const ctx = { ...baseCtx, hasPlatformSubscription: true };
    expect(hasContentAccess(ctx, "creator_456", "subscribers")).toBe(true);
  });

  it("allows user with creator-specific subscription", () => {
    const ctx = { ...baseCtx, subscribedCreatorIds: new Set(["creator_456"]) };
    expect(hasContentAccess(ctx, "creator_456", "subscribers")).toBe(true);
  });

  it("allows creator team member access to their creator's content", () => {
    const ctx = { ...baseCtx, memberCreatorIds: new Set(["creator_456"]) };
    expect(hasContentAccess(ctx, "creator_456", "subscribers")).toBe(true);
  });

  it("denies user with subscription for different creator", () => {
    const ctx = { ...baseCtx, subscribedCreatorIds: new Set(["creator_other"]) };
    expect(hasContentAccess(ctx, "creator_456", "subscribers")).toBe(false);
  });

  it("denies subscriber with no subscriptions", () => {
    expect(hasContentAccess(baseCtx, "creator_456", "subscribers")).toBe(false);
  });
});
