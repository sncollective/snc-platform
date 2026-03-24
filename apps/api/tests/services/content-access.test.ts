import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { Visibility } from "@snc/shared";

import { TEST_CONFIG } from "../helpers/test-constants.js";

// ── Mock State ──

// SELECT chain for innerJoin path: db.select().from().innerJoin().where().limit()
const mockSubscriptionLimit = vi.fn();
const mockSubscriptionWhere = vi.fn(() => ({ limit: mockSubscriptionLimit }));
const mockInnerJoin = vi.fn(() => ({ where: mockSubscriptionWhere }));

// SELECT chain for direct where path: db.select().from().where()
// Used by creatorMembers queries (no innerJoin)
// The where() result needs .limit() for the "any membership" query in checkContentAccess
const mockMemberLimit = vi.fn();
const mockMemberWhere = vi.fn(() => ({ limit: mockMemberLimit }));

// Track which table is being queried to route to the right chain
const mockSelectFrom = vi.fn((table: unknown) => {
  const tableObj = table as Record<string, unknown>;
  if ("creatorId" in tableObj && "userId" in tableObj && "role" in tableObj) {
    return { innerJoin: mockInnerJoin, where: mockMemberWhere };
  }
  return { innerJoin: mockInnerJoin, where: mockSubscriptionWhere };
});
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
    // Default: no memberships, no roles, no subscriptions
    // buildContentAccessContext uses mockMemberWhere (direct await) and
    // mockSubscriptionWhere (direct await via innerJoin chain)
    mockMemberWhere.mockResolvedValue([]);
    mockSubscriptionWhere.mockResolvedValue([]);
    mockGetUserRoles.mockResolvedValue([]);
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
      mockMemberWhere.mockResolvedValue([{ creatorId: "creator_456" }]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({ allowed: true });
    });

    it("falls through to SUBSCRIPTION_REQUIRED when user is not a team member", async () => {
      mockMemberWhere.mockResolvedValue([]);
      mockSubscriptionWhere.mockResolvedValue([]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({
        allowed: false,
        reason: "SUBSCRIPTION_REQUIRED",
        creatorId: "creator_456",
      });
    });
  });

  describe("stakeholder role bypass", () => {
    it("returns allowed when user has stakeholder role", async () => {
      mockGetUserRoles.mockResolvedValue(["stakeholder"]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({ allowed: true });
    });

    it("falls through to subscription check when user lacks stakeholder role", async () => {
      mockGetUserRoles.mockResolvedValue([]);
      mockMemberWhere.mockResolvedValue([]);
      mockSubscriptionWhere.mockResolvedValue([]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({
        allowed: false,
        reason: "SUBSCRIPTION_REQUIRED",
        creatorId: "creator_456",
      });
    });
  });

  describe("any creator team member bypass", () => {
    it("returns allowed when user is a member of any creator", async () => {
      mockMemberWhere.mockResolvedValue([{ creatorId: "other_creator" }]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({ allowed: true });
    });
  });

  describe("active platform subscription", () => {
    it("returns allowed when user has active platform subscription", async () => {
      mockMemberWhere.mockResolvedValue([]);
      mockSubscriptionWhere.mockResolvedValue([
        { planType: "platform", planCreatorId: null },
      ]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers");

      expect(result).toEqual({ allowed: true });
    });
  });

  describe("no subscription", () => {
    it("returns not allowed when user has no subscriptions", async () => {
      mockMemberWhere.mockResolvedValue([]);
      mockSubscriptionWhere.mockResolvedValue([]);

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
      mockMemberWhere.mockResolvedValue([]);
      mockSubscriptionWhere.mockResolvedValue([]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers", []);

      expect(result).toEqual({
        allowed: false,
        reason: "SUBSCRIPTION_REQUIRED",
        creatorId: "creator_456",
      });
      expect(mockGetUserRoles).not.toHaveBeenCalled();
    });

    it("returns allowed when prefetchedRoles includes stakeholder", async () => {
      mockMemberWhere.mockResolvedValue([]);

      const result = await checkContentAccess("user_123", "creator_456", "subscribers", ["stakeholder"]);

      expect(result).toEqual({ allowed: true });
      expect(mockGetUserRoles).not.toHaveBeenCalled();
    });

    it("falls back to getUserRoles when prefetchedRoles is undefined", async () => {
      mockGetUserRoles.mockResolvedValue([]);
      mockMemberWhere.mockResolvedValue([]);
      mockSubscriptionWhere.mockResolvedValue([]);

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
    mockSubscriptionLimit.mockResolvedValue([]);
    mockSubscriptionWhere.mockReturnValue({ limit: mockSubscriptionLimit });
    mockMemberWhere.mockResolvedValue([]);
    mockMemberLimit.mockResolvedValue([]);
    mockGetUserRoles.mockResolvedValue([]);
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

  it("grants free access for stakeholder role", async () => {
    mockGetUserRoles.mockResolvedValue(["stakeholder"]);
    mockMemberWhere.mockResolvedValue([]);

    const ctx = await buildContentAccessContext("user_123");

    expect(ctx.userId).toBe("user_123");
    expect(ctx.roles).toContain("stakeholder");
    expect(ctx.hasPlatformSubscription).toBe(true);
  });

  it("grants free access for any creator team member", async () => {
    mockGetUserRoles.mockResolvedValue([]);
    mockMemberWhere.mockResolvedValue([{ creatorId: "creator_A" }]);

    const ctx = await buildContentAccessContext("user_123");

    expect(ctx.userId).toBe("user_123");
    expect(ctx.memberCreatorIds.has("creator_A")).toBe(true);
    expect(ctx.hasPlatformSubscription).toBe(true);
  });

  it("fetches subscriptions for regular user", async () => {
    mockGetUserRoles.mockResolvedValue([]);
    mockMemberWhere.mockResolvedValue([]);
    // The batch subscription query uses innerJoin → where chain (no limit)
    mockSubscriptionWhere.mockResolvedValue([
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
    mockGetUserRoles.mockResolvedValue([]);
    mockMemberWhere.mockResolvedValue([]);
    mockSubscriptionWhere.mockResolvedValue([
      { planType: "creator", planCreatorId: "creator_B" },
    ]);

    const ctx = await buildContentAccessContext("user_123");

    expect(ctx.hasPlatformSubscription).toBe(false);
    expect(ctx.subscribedCreatorIds.has("creator_B")).toBe(true);
  });

  it("uses prefetchedRoles instead of querying getUserRoles", async () => {
    mockMemberWhere.mockResolvedValue([]);
    mockSubscriptionWhere.mockResolvedValue([]);

    const ctx = await buildContentAccessContext("user_123", []);

    expect(ctx.roles).toEqual([]);
    expect(mockGetUserRoles).not.toHaveBeenCalled();
    expect(mockSelect).toHaveBeenCalled();
  });

  it("skips subscription query for prefetched stakeholder role", async () => {
    mockMemberWhere.mockResolvedValue([]);

    const ctx = await buildContentAccessContext("user_123", ["stakeholder"]);

    expect(ctx.roles).toContain("stakeholder");
    expect(ctx.hasPlatformSubscription).toBe(true);
    expect(mockGetUserRoles).not.toHaveBeenCalled();
  });

  it("ignores prefetchedRoles for null userId", async () => {
    const ctx = await buildContentAccessContext(null, ["stakeholder"]);

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
    mockSubscriptionLimit.mockResolvedValue([]);
    mockMemberWhere.mockResolvedValue([]);
    mockMemberLimit.mockResolvedValue([]);
    mockGetUserRoles.mockResolvedValue([]);
    const mod = await setupContentGate();
    hasContentAccess = mod.hasContentAccess;
  });

  afterEach(() => {
    vi.resetModules();
  });

  const baseCtx = {
    userId: "user_123",
    roles: [] as string[],
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

  it("allows user with stakeholder role", () => {
    const ctx = { ...baseCtx, roles: ["stakeholder"] };
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

  it("denies regular user with no subscriptions", () => {
    expect(hasContentAccess(baseCtx, "creator_456", "subscribers")).toBe(false);
  });
});
