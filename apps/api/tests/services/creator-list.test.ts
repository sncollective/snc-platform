import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mock DB Chains ──

const mockSelectWhere = vi.fn();
const mockSelectInnerJoin = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();

const mockDb = { select: mockSelect };

// ── Setup ──

const setupCreatorListService = async () => {
  vi.doMock("../../src/db/connection.js", () => ({ db: mockDb }));

  vi.doMock("../../src/db/schema/content.schema.js", () => ({
    content: {
      creatorId: {},
      deletedAt: {},
      publishedAt: {},
    },
  }));

  vi.doMock("../../src/db/schema/subscription.schema.js", () => ({
    userSubscriptions: {
      id: {},
      userId: {},
      planId: {},
      status: {},
    },
    subscriptionPlans: {
      id: {},
      type: {},
      creatorId: {},
    },
  }));

  return await import("../../src/services/creator-list.js");
};

// ── Tests ──

describe("creator-list service", () => {
  afterEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  // ── batchGetContentCounts ──

  describe("batchGetContentCounts", () => {
    it("returns empty map for empty creatorIds array", async () => {
      const { batchGetContentCounts } = await setupCreatorListService();
      const result = await batchGetContentCounts([]);
      expect(result).toEqual(new Map());
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("returns content counts keyed by creator ID", async () => {
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockReturnValue({
        groupBy: () =>
          Promise.resolve([
            { creatorId: "creator_1", count: 3 },
            { creatorId: "creator_2", count: 7 },
          ]),
      });

      const { batchGetContentCounts } = await setupCreatorListService();
      const result = await batchGetContentCounts(["creator_1", "creator_2"]);

      expect(result.get("creator_1")).toBe(3);
      expect(result.get("creator_2")).toBe(7);
    });

    it("returns map with 0 implicit for missing creators", async () => {
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockReturnValue({
        groupBy: () => Promise.resolve([{ creatorId: "creator_1", count: 2 }]),
      });

      const { batchGetContentCounts } = await setupCreatorListService();
      const result = await batchGetContentCounts(["creator_1", "creator_2"]);

      expect(result.get("creator_1")).toBe(2);
      expect(result.has("creator_2")).toBe(false);
    });
  });

  // ── batchGetSubscriberCounts ──

  describe("batchGetSubscriberCounts", () => {
    it("returns empty map for empty creatorIds array", async () => {
      const { batchGetSubscriberCounts } = await setupCreatorListService();
      const result = await batchGetSubscriberCounts([]);
      expect(result).toEqual(new Map());
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("returns subscriber counts keyed by creator ID", async () => {
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockReturnValue({ innerJoin: mockSelectInnerJoin });
      mockSelectInnerJoin.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockReturnValue({
        groupBy: () =>
          Promise.resolve([
            { creatorId: "creator_1", count: 5 },
            { creatorId: "creator_2", count: 2 },
          ]),
      });

      const { batchGetSubscriberCounts } = await setupCreatorListService();
      const result = await batchGetSubscriberCounts(["creator_1", "creator_2"]);

      expect(result.get("creator_1")).toBe(5);
      expect(result.get("creator_2")).toBe(2);
    });

    it("filters out null creatorId entries", async () => {
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockReturnValue({ innerJoin: mockSelectInnerJoin });
      mockSelectInnerJoin.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockReturnValue({
        groupBy: () =>
          Promise.resolve([
            { creatorId: "creator_1", count: 3 },
            { creatorId: null, count: 1 },
          ]),
      });

      const { batchGetSubscriberCounts } = await setupCreatorListService();
      const result = await batchGetSubscriberCounts(["creator_1"]);

      expect(result.size).toBe(1);
      expect(result.get("creator_1")).toBe(3);
    });
  });

  // ── batchGetSubscribedCreatorIds ──

  describe("batchGetSubscribedCreatorIds", () => {
    it("returns empty set for empty creatorIds array", async () => {
      const { batchGetSubscribedCreatorIds } = await setupCreatorListService();
      const result = await batchGetSubscribedCreatorIds("user_1", []);
      expect(result).toEqual(new Set());
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("returns all creator IDs when user has an active platform subscription", async () => {
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockReturnValue({ innerJoin: mockSelectInnerJoin });
      mockSelectInnerJoin.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockReturnValue({
        limit: () => Promise.resolve([{ id: "sub_platform_1" }]),
      });

      const { batchGetSubscribedCreatorIds } = await setupCreatorListService();
      const result = await batchGetSubscribedCreatorIds("user_1", [
        "creator_1",
        "creator_2",
      ]);

      expect(result).toEqual(new Set(["creator_1", "creator_2"]));
    });

    it("returns specific subscribed creator IDs when no platform subscription", async () => {
      let callCount = 0;
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockReturnValue({ innerJoin: mockSelectInnerJoin });
      mockSelectInnerJoin.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Platform sub check — not found
          return { limit: () => Promise.resolve([]) };
        }
        // Creator-specific subs
        return Promise.resolve([{ creatorId: "creator_1" }]);
      });

      const { batchGetSubscribedCreatorIds } = await setupCreatorListService();
      const result = await batchGetSubscribedCreatorIds("user_1", [
        "creator_1",
        "creator_2",
      ]);

      expect(result).toEqual(new Set(["creator_1"]));
      expect(result.has("creator_2")).toBe(false);
    });

    it("returns empty set when user has no subscriptions", async () => {
      let callCount = 0;
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockReturnValue({ innerJoin: mockSelectInnerJoin });
      mockSelectInnerJoin.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { limit: () => Promise.resolve([]) };
        }
        return Promise.resolve([]);
      });

      const { batchGetSubscribedCreatorIds } = await setupCreatorListService();
      const result = await batchGetSubscribedCreatorIds("user_1", [
        "creator_1",
      ]);

      expect(result).toEqual(new Set());
    });
  });

  // ── batchGetLastPublished ──

  describe("batchGetLastPublished", () => {
    it("returns empty map for empty creatorIds array", async () => {
      const { batchGetLastPublished } = await setupCreatorListService();
      const result = await batchGetLastPublished([]);
      expect(result).toEqual(new Map());
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("returns ISO string dates keyed by creator ID", async () => {
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockReturnValue({
        groupBy: () =>
          Promise.resolve([
            { creatorId: "creator_1", lastPublished: "2026-01-15T12:00:00" },
            { creatorId: "creator_2", lastPublished: "2025-11-01T08:30:00" },
          ]),
      });

      const { batchGetLastPublished } = await setupCreatorListService();
      const result = await batchGetLastPublished(["creator_1", "creator_2"]);

      expect(result.get("creator_1")).toBe(
        new Date("2026-01-15T12:00:00").toISOString(),
      );
      expect(result.get("creator_2")).toBe(
        new Date("2025-11-01T08:30:00").toISOString(),
      );
    });

    it("returns map with only creators that have published content", async () => {
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockReturnValue({
        groupBy: () =>
          Promise.resolve([
            { creatorId: "creator_1", lastPublished: "2026-03-01T00:00:00" },
          ]),
      });

      const { batchGetLastPublished } = await setupCreatorListService();
      const result = await batchGetLastPublished(["creator_1", "creator_2"]);

      expect(result.size).toBe(1);
      expect(result.has("creator_2")).toBe(false);
    });
  });
});
