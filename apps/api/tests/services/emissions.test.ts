import { describe, it, expect, vi, afterEach } from "vitest";

import { makeMockEmissionRow } from "../helpers/emissions-fixtures.js";

// ── Mock DB Chains ──

const mockSelectWhere = vi.fn();
const mockSelectGroupBy = vi.fn();
const mockSelectOrderBy = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();

const mockDb = {
  select: mockSelect,
};

// ── Setup ──

const setupEmissionsService = async () => {
  vi.doMock("../../src/db/connection.js", () => ({ db: mockDb }));
  vi.doMock("../../src/db/schema/emission.schema.js", () => ({
    emissions: {
      id: {},
      date: {},
      scope: {},
      category: {},
      subcategory: {},
      source: {},
      description: {},
      amount: {},
      unit: {},
      co2Kg: {},
      method: {},
      projected: {},
      metadata: {},
      createdAt: {},
      updatedAt: {},
    },
  }));

  return await import("../../src/services/emissions.js");
};

// ── Default Summary Row ──

const summaryRow = {
  grossCo2Kg: "0.034443",
  projectedCo2Kg: "0.5",
  offsetCo2Kg: "0.01",
  entryCount: "1",
  latestDate: "2026-03-31",
};

const emptySummaryRow = {
  grossCo2Kg: "0",
  projectedCo2Kg: "0",
  offsetCo2Kg: "0",
  entryCount: "0",
  latestDate: null,
};

// ── Tests ──

describe("emissions service", () => {
  afterEach(() => {
    vi.resetModules();
  });

  describe("fetchEmissionsSummary", () => {
    it("computes derived fields from query row", async () => {
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockResolvedValue([summaryRow]);

      const { fetchEmissionsSummary } = await setupEmissionsService();
      const result = await fetchEmissionsSummary();

      expect(result.grossCo2Kg).toBe(0.034443);
      expect(result.offsetCo2Kg).toBe(0.01);
      expect(result.netCo2Kg).toBeCloseTo(0.024443);
      expect(result.entryCount).toBe(1);
      expect(result.latestDate).toBe("2026-03-31");
      expect(result.projectedGrossCo2Kg).toBeCloseTo(0.534443);
      expect(result.doubleOffsetTargetCo2Kg).toBeCloseTo(1.068886);
      expect(result.additionalOffsetCo2Kg).toBeCloseTo(1.058886);
    });

    it("returns zeros for an empty table", async () => {
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockResolvedValue([emptySummaryRow]);

      const { fetchEmissionsSummary } = await setupEmissionsService();
      const result = await fetchEmissionsSummary();

      expect(result.grossCo2Kg).toBe(0);
      expect(result.offsetCo2Kg).toBe(0);
      expect(result.netCo2Kg).toBe(0);
      expect(result.entryCount).toBe(0);
      expect(result.latestDate).toBeNull();
      expect(result.projectedGrossCo2Kg).toBe(0);
      expect(result.doubleOffsetTargetCo2Kg).toBe(0);
      expect(result.additionalOffsetCo2Kg).toBe(0);
    });

    it("clamps additionalOffsetCo2Kg to zero when offsets exceed target", async () => {
      // offset (50) > doubleOffsetTarget (2 * (1 + 0) = 2) → clamped to 0
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom.mockResolvedValue([
        {
          grossCo2Kg: "1",
          projectedCo2Kg: "0",
          offsetCo2Kg: "50",
          entryCount: "1",
          latestDate: "2026-03-31",
        },
      ]);

      const { fetchEmissionsSummary } = await setupEmissionsService();
      const result = await fetchEmissionsSummary();

      expect(result.additionalOffsetCo2Kg).toBe(0);
    });
  });

  describe("fetchEmissionsBreakdown", () => {
    it("returns all breakdown sections with numeric coercion", async () => {
      const row = makeMockEmissionRow();

      mockSelect.mockReturnValue({ from: mockSelectFrom });
      // 5 calls to .from() in Promise.all order:
      // 1. summary query
      // 2. byScope: .from().where().groupBy()
      // 3. byCategory: .from().where().groupBy()
      // 4. monthly: .from().groupBy().orderBy()
      // 5. entries: .from().orderBy()
      mockSelectFrom
        .mockImplementationOnce(() => Promise.resolve([summaryRow]))
        .mockImplementationOnce(() => ({
          where: () => ({
            groupBy: () =>
              Promise.resolve([{ scope: 2, co2Kg: "0.034443", entryCount: 1 }]),
          }),
        }))
        .mockImplementationOnce(() => ({
          where: () => ({
            groupBy: () =>
              Promise.resolve([{ category: "cloud-compute", co2Kg: "0.034443", entryCount: 1 }]),
          }),
        }))
        .mockImplementationOnce(() => ({
          groupBy: () => ({
            orderBy: () =>
              Promise.resolve([
                { month: "2026-03", actualCo2Kg: "0.034443", projectedCo2Kg: "0", offsetCo2Kg: "0.01" },
              ]),
          }),
        }))
        .mockImplementationOnce(() => ({
          orderBy: () => Promise.resolve([row]),
        }));

      const { fetchEmissionsBreakdown } = await setupEmissionsService();
      const result = await fetchEmissionsBreakdown();

      expect(result.summary.grossCo2Kg).toBe(0.034443);
      expect(result.byScope).toHaveLength(1);
      expect(result.byScope[0]?.co2Kg).toBe(0.034443);
      expect(result.byCategory).toHaveLength(1);
      expect(result.byCategory[0]?.co2Kg).toBe(0.034443);
      expect(result.monthly).toHaveLength(1);
      expect(result.monthly[0]?.actualCo2Kg).toBe(0.034443);
      expect(result.monthly[0]?.projectedCo2Kg).toBe(0);
      expect(result.monthly[0]?.offsetCo2Kg).toBe(0.01);
      expect(result.entries).toHaveLength(1);
      // entries are raw DB rows (not transformed)
      expect(result.entries[0]?.id).toBe(row.id);
    });

    it("returns empty arrays when table is empty", async () => {
      mockSelect.mockReturnValue({ from: mockSelectFrom });
      mockSelectFrom
        .mockImplementationOnce(() => Promise.resolve([emptySummaryRow]))
        .mockImplementationOnce(() => ({
          where: () => ({ groupBy: () => Promise.resolve([]) }),
        }))
        .mockImplementationOnce(() => ({
          where: () => ({ groupBy: () => Promise.resolve([]) }),
        }))
        .mockImplementationOnce(() => ({
          groupBy: () => ({ orderBy: () => Promise.resolve([]) }),
        }))
        .mockImplementationOnce(() => ({
          orderBy: () => Promise.resolve([]),
        }));

      const { fetchEmissionsBreakdown } = await setupEmissionsService();
      const result = await fetchEmissionsBreakdown();

      expect(result.byScope).toHaveLength(0);
      expect(result.byCategory).toHaveLength(0);
      expect(result.monthly).toHaveLength(0);
      expect(result.entries).toHaveLength(0);
    });
  });
});
