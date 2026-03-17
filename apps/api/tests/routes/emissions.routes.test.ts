import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockEmissionRow } from "../helpers/emissions-fixtures.js";
import { chainablePromise } from "../helpers/db-mock-utils.js";

// ── Mock DB Chains ──

const mockSelectWhere = vi.fn();
const mockSelectGroupBy = vi.fn();
const mockSelectOrderBy = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();
const mockInsert = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
};

// ── Test Setup ──

const ctx = setupRouteTest({
  db: mockDb,
  mocks: () => {
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
  },
  mountRoute: async (app) => {
    const { emissionsRoutes } = await import(
      "../../src/routes/emissions.routes.js"
    );
    app.route("/api/emissions", emissionsRoutes);
  },
  beforeEach: () => {
    // Re-establish SELECT chain after clearAllMocks.
    // Summary: db.select({...}).from(emissions) -> resolves directly (single aggregation query)
    // Breakdown queries: .from().where().groupBy(), .from().groupBy().orderBy(), .from().orderBy()
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockImplementation(() =>
      chainablePromise(
        [{ grossCo2Kg: "0", projectedCo2Kg: "0", offsetCo2Kg: "0", entryCount: "0", latestDate: null }],
        { where: mockSelectWhere, groupBy: mockSelectGroupBy, orderBy: mockSelectOrderBy },
      ),
    );
    mockSelectWhere.mockImplementation(() =>
      chainablePromise(
        [],
        { groupBy: mockSelectGroupBy, orderBy: mockSelectOrderBy },
      ),
    );
    mockSelectGroupBy.mockImplementation(() =>
      chainablePromise([], { orderBy: mockSelectOrderBy }),
    );
    mockSelectOrderBy.mockResolvedValue([]);

    // INSERT chain: db.insert(table).values({...}).returning()
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValue([makeMockEmissionRow()]);
  },
});

// ── Tests ──

describe("emissions routes", () => {
  // ── GET /api/emissions/summary ──

  describe("GET /api/emissions/summary", () => {
    it("returns emissions summary with gross/offset/net and projection fields", async () => {
      // Single aggregation query returns all summary fields
      mockSelectFrom.mockImplementationOnce(() =>
        Promise.resolve([
          {
            grossCo2Kg: "0.034443",
            projectedCo2Kg: "0.5",
            offsetCo2Kg: "0.01",
            entryCount: "1",
            latestDate: "2026-03-31",
          },
        ]),
      );

      const res = await ctx.app.request("/api/emissions/summary");
      const body = await res.json() as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(body.grossCo2Kg).toBe(0.034443);
      expect(body.offsetCo2Kg).toBe(0.01);
      expect(body.netCo2Kg).toBeCloseTo(0.024443);
      expect(body.entryCount).toBe(1);
      expect(body.latestDate).toBe("2026-03-31");
      // Projection fields
      expect(body.projectedGrossCo2Kg).toBeCloseTo(0.534443);
      expect(body.doubleOffsetTargetCo2Kg).toBeCloseTo(1.068886);
      expect(body.additionalOffsetCo2Kg).toBeCloseTo(1.058886);
    });

    it("returns zeros when no entries", async () => {
      const res = await ctx.app.request("/api/emissions/summary");
      const body = await res.json() as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(body.grossCo2Kg).toBe(0);
      expect(body.offsetCo2Kg).toBe(0);
      expect(body.netCo2Kg).toBe(0);
      expect(body.entryCount).toBe(0);
      expect(body.latestDate).toBeNull();
      expect(body.projectedGrossCo2Kg).toBe(0);
      expect(body.doubleOffsetTargetCo2Kg).toBe(0);
      expect(body.additionalOffsetCo2Kg).toBe(0);
    });

    it("returns 200 for unauthenticated request", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/emissions/summary");

      expect(res.status).toBe(200);
    });
  });

  // ── GET /api/emissions/breakdown ──

  describe("GET /api/emissions/breakdown", () => {
    it("returns full breakdown with projection fields and split monthly data", async () => {
      const row = makeMockEmissionRow();

      // The breakdown handler calls Promise.all with 5 queries:
      // 1. fetchEmissionsSummary: db.select({...}).from(emissions) -> resolves directly
      // 2. byScope: db.select({...}).from(emissions).where(...).groupBy(scope)
      // 3. byCategory: db.select({...}).from(emissions).where(...).groupBy(category)
      // 4. monthly: db.select({...}).from(emissions).groupBy(month).orderBy(month)
      // 5. entries: db.select().from(emissions).orderBy(desc(date))

      mockSelectFrom
        // Summary query (resolves directly from .from())
        .mockImplementationOnce(() =>
          Promise.resolve([
            {
              grossCo2Kg: "0.034443",
              projectedCo2Kg: "0.5",
              offsetCo2Kg: "0.01",
              entryCount: "1",
              latestDate: "2026-03-31",
            },
          ]),
        )
        // By scope query
        .mockImplementationOnce(() => ({
          where: () => ({
            groupBy: () =>
              Promise.resolve([
                { scope: 2, co2Kg: "0.034443" },
              ]),
          }),
        }))
        // By category query
        .mockImplementationOnce(() => ({
          where: () => ({
            groupBy: () =>
              Promise.resolve([
                { category: "cloud-compute", co2Kg: "0.034443" },
              ]),
          }),
        }))
        // Monthly query
        .mockImplementationOnce(() => ({
          groupBy: () => ({
            orderBy: () =>
              Promise.resolve([
                { month: "2026-03", actualCo2Kg: "0.034443", projectedCo2Kg: "0", offsetCo2Kg: "0.01" },
              ]),
          }),
        }))
        // Entries query
        .mockImplementationOnce(() => ({
          orderBy: () => Promise.resolve([row]),
        }));

      const res = await ctx.app.request("/api/emissions/breakdown");
      const body = await res.json() as Record<string, any>;

      expect(res.status).toBe(200);
      expect(body.summary.grossCo2Kg).toBe(0.034443);
      expect(body.summary.offsetCo2Kg).toBe(0.01);
      expect(body.summary.netCo2Kg).toBeCloseTo(0.024443);
      expect(body.summary.projectedGrossCo2Kg).toBeCloseTo(0.534443);
      expect(body.summary.doubleOffsetTargetCo2Kg).toBeCloseTo(1.068886);
      expect(body.byScope).toHaveLength(1);
      expect(body.byCategory).toHaveLength(1);
      expect(body.monthly).toHaveLength(1);
      expect(body.monthly[0].actualCo2Kg).toBe(0.034443);
      expect(body.monthly[0].projectedCo2Kg).toBe(0);
      expect(body.monthly[0].offsetCo2Kg).toBe(0.01);
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].projected).toBe(false);
      expect(body.entries[0].createdAt).toBe("2026-03-31T00:00:00.000Z");
    });

    it("returns 200 for unauthenticated request", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/emissions/breakdown");
      const body = await res.json() as Record<string, any>;

      expect(res.status).toBe(200);
      expect(body.entries).toBeDefined();
    });

    it("strips sessionDates from entry metadata", async () => {
      const row = makeMockEmissionRow({
        metadata: {
          inputTokens: 100,
          sessionDates: ["2026-03-01", "2026-03-02"],
        },
      });

      mockSelectFrom
        // Summary query
        .mockImplementationOnce(() =>
          Promise.resolve([
            {
              grossCo2Kg: "0.01",
              projectedCo2Kg: "0",
              offsetCo2Kg: "0",
              entryCount: "1",
              latestDate: "2026-03-31",
            },
          ]),
        )
        // By scope query
        .mockImplementationOnce(() => ({
          where: () => ({
            groupBy: () => Promise.resolve([]),
          }),
        }))
        // By category query
        .mockImplementationOnce(() => ({
          where: () => ({
            groupBy: () => Promise.resolve([]),
          }),
        }))
        // Monthly query
        .mockImplementationOnce(() => ({
          groupBy: () => ({
            orderBy: () => Promise.resolve([]),
          }),
        }))
        // Entries query
        .mockImplementationOnce(() => ({
          orderBy: () => Promise.resolve([row]),
        }));

      const res = await ctx.app.request("/api/emissions/breakdown");
      const body = await res.json() as Record<string, any>;

      expect(res.status).toBe(200);
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].metadata).toEqual({ inputTokens: 100 });
      expect(body.entries[0].metadata.sessionDates).toBeUndefined();
    });
  });

  // ── POST /api/emissions/entries ──

  describe("POST /api/emissions/entries", () => {
    const validBody = {
      date: "2026-03-31",
      scope: 2,
      category: "cloud-compute",
      subcategory: "ai-development",
      source: "Claude Code",
      description: "Test entry",
      amount: 100,
      unit: "tokens",
      co2Kg: 0.001,
      method: "token-estimate",
    };

    it("creates and returns a new entry", async () => {
      ctx.auth.roles = ["admin"];

      const res = await ctx.app.request("/api/emissions/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });
      const body = await res.json() as Record<string, unknown>;

      expect(res.status).toBe(201);
      expect(body.id).toBeDefined();
      expect(body.date).toBe("2026-03-31");
      expect(body.projected).toBe(false);
    });

    it("creates a projected entry when projected=true", async () => {
      ctx.auth.roles = ["admin"];
      const projectedRow = makeMockEmissionRow({ projected: true });
      mockInsertReturning.mockResolvedValue([projectedRow]);

      const res = await ctx.app.request("/api/emissions/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, projected: true }),
      });
      const body = await res.json() as Record<string, unknown>;

      expect(res.status).toBe(201);
      expect(body.projected).toBe(true);
    });

    it("returns 400 for invalid body", async () => {
      ctx.auth.roles = ["admin"];

      const res = await ctx.app.request("/api/emissions/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "bad" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 401 for unauthenticated request", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/emissions/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/emissions/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(403);
    });
  });

  // ── POST /api/emissions/offsets ──

  describe("POST /api/emissions/offsets", () => {
    const validOffset = {
      date: "2026-03-31",
      source: "Gold Standard VER",
      description: "Voluntary carbon offset",
      amount: 1,
      unit: "credits",
      co2Kg: 10,
      method: "verified-offset",
    };

    it("creates an offset entry with scope 0 and negative co2Kg", async () => {
      ctx.auth.roles = ["admin"];
      const offsetRow = makeMockEmissionRow({
        scope: 0,
        category: "offset",
        co2Kg: -10,
      });
      mockInsertReturning.mockResolvedValue([offsetRow]);

      const res = await ctx.app.request("/api/emissions/offsets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validOffset),
      });
      const body = await res.json() as Record<string, unknown>;

      expect(res.status).toBe(201);
      expect(body.scope).toBe(0);
      expect(body.co2Kg).toBe(-10);
    });

    it("returns 400 for invalid body", async () => {
      ctx.auth.roles = ["admin"];

      const res = await ctx.app.request("/api/emissions/offsets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "bad" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 401 for unauthenticated request", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/emissions/offsets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validOffset),
      });

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin", async () => {
      ctx.auth.roles = [];

      const res = await ctx.app.request("/api/emissions/offsets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validOffset),
      });

      expect(res.status).toBe(403);
    });
  });
});
