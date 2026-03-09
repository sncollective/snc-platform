import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockMonthlyRevenue } from "../helpers/dashboard-fixtures.js";
import { chainablePromise } from "../helpers/db-mock-utils.js";

// ── Mock Revenue Service ──

const mockGetMonthlyRevenue = vi.fn();

// ── Mock DB Chains ──

// COUNT queries: db.select({ count: count() }).from(table).where(...)
// The dashboard routes use only COUNT(*) queries — no JOIN chains needed.
//
// SELECT chain: .select(...).from(table).where(...)
const mockSelectWhere = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelect = vi.fn();

const mockDb = {
  select: mockSelect,
};

// ── Test Setup ──

const ctx = setupRouteTest({
  db: mockDb,
  defaultAuth: { roles: ["cooperative-member"] },
  mocks: () => {
    vi.doMock("../../src/db/schema/subscription.schema.js", () => ({
      userSubscriptions: {
        id: {},
        userId: {},
        planId: {},
        stripeSubscriptionId: {},
        stripeCustomerId: {},
        status: {},
        currentPeriodEnd: {},
        cancelAtPeriodEnd: {},
        createdAt: {},
        updatedAt: {},
      },
      subscriptionPlans: {},
      paymentEvents: {},
    }));

    vi.doMock("../../src/db/schema/booking.schema.js", () => ({
      services: {},
      bookingRequests: {
        id: {},
        userId: {},
        serviceId: {},
        preferredDates: {},
        notes: {},
        status: {},
        reviewedBy: {},
        reviewNote: {},
        createdAt: {},
        updatedAt: {},
      },
    }));

    vi.doMock("../../src/services/revenue.js", () => ({
      getMonthlyRevenue: mockGetMonthlyRevenue,
    }));
  },
  mountRoute: async (app) => {
    const { dashboardRoutes } = await import(
      "../../src/routes/dashboard.routes.js"
    );
    app.route("/api/dashboard", dashboardRoutes);
  },
  beforeEach: () => {
    // Re-establish SELECT chain after clearAllMocks.
    // .from() must be both terminal (await-able) AND have a .where method,
    // because some queries end at .from() (total count) and others chain .where() (pending/active).
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockImplementation(() =>
      chainablePromise([{ count: 0 }], { where: mockSelectWhere }),
    );
    mockSelectWhere.mockResolvedValue([{ count: 0 }]);

    // Default: revenue service returns empty 12-month array
    mockGetMonthlyRevenue.mockResolvedValue({
      ok: true,
      value: [],
    });
  },
});

// ── Tests ──

describe("dashboard routes", () => {
  // ── GET /api/dashboard/revenue ──

  describe("GET /api/dashboard/revenue", () => {
    it("returns current month total and monthly breakdown", async () => {
      const now = new Date();
      const currentMonth = now.getUTCMonth() + 1;
      const currentYear = now.getUTCFullYear();
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

      const monthly = [
        makeMockMonthlyRevenue({
          month: currentMonth,
          year: currentYear,
          amount: 7500,
        }),
        makeMockMonthlyRevenue({
          month: prevMonth,
          year: prevYear,
          amount: 5000,
        }),
      ];

      mockGetMonthlyRevenue.mockResolvedValue({ ok: true, value: monthly });

      const res = await ctx.app.request("/api/dashboard/revenue");
      const body = (await res.json()) as {
        currentMonth: number;
        monthly: unknown[];
      };

      expect(res.status).toBe(200);
      expect(body.currentMonth).toBe(7500);
      expect(body.monthly).toHaveLength(2);
      expect(mockGetMonthlyRevenue).toHaveBeenCalledWith(12);
    });

    it("returns currentMonth as 0 when current month has no revenue", async () => {
      // Return months that do NOT include the current month
      const monthly = [
        makeMockMonthlyRevenue({ month: 1, year: 2025, amount: 3000 }),
        makeMockMonthlyRevenue({ month: 2, year: 2025, amount: 4000 }),
      ];

      mockGetMonthlyRevenue.mockResolvedValue({ ok: true, value: monthly });

      const res = await ctx.app.request("/api/dashboard/revenue");
      const body = (await res.json()) as {
        currentMonth: number;
        monthly: unknown[];
      };

      expect(res.status).toBe(200);
      expect(body.currentMonth).toBe(0);
      expect(body.monthly).toHaveLength(2);
    });

    it("returns 502 when revenue service fails", async () => {
      const { AppError } = await import("@snc/shared");
      mockGetMonthlyRevenue.mockResolvedValue({
        ok: false,
        error: new AppError("REVENUE_ERROR", "Stripe API failure", 502),
      });

      const res = await ctx.app.request("/api/dashboard/revenue");
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(502);
      expect(body.error.code).toBe("REVENUE_ERROR");
    });

    it("returns 503 when Stripe is not configured", async () => {
      const { AppError } = await import("@snc/shared");
      mockGetMonthlyRevenue.mockResolvedValue({
        ok: false,
        error: new AppError(
          "BILLING_NOT_CONFIGURED",
          "Stripe integration is not configured",
          503,
        ),
      });

      const res = await ctx.app.request("/api/dashboard/revenue");
      const body = (await res.json()) as { error: { code: string } };

      expect(res.status).toBe(503);
      expect(body.error.code).toBe("BILLING_NOT_CONFIGURED");
    });

    it("returns 403 for non-cooperative-member", async () => {
      ctx.auth.roles = ["subscriber"];

      const res = await ctx.app.request("/api/dashboard/revenue");

      expect(res.status).toBe(403);
    });

    it("returns 401 for unauthenticated request", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/dashboard/revenue");

      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/dashboard/subscribers ──

  describe("GET /api/dashboard/subscribers", () => {
    it("returns active subscriber count", async () => {
      mockSelectWhere.mockResolvedValue([{ count: 42 }]);

      const res = await ctx.app.request("/api/dashboard/subscribers");
      const body = (await res.json()) as { active: number };

      expect(res.status).toBe(200);
      expect(body.active).toBe(42);
    });

    it("returns { active: 0 } when no active subscribers", async () => {
      // Default mock already returns [{ count: 0 }]
      const res = await ctx.app.request("/api/dashboard/subscribers");
      const body = (await res.json()) as { active: number };

      expect(res.status).toBe(200);
      expect(body.active).toBe(0);
    });

    it("returns 403 for non-cooperative-member", async () => {
      ctx.auth.roles = ["subscriber"];

      const res = await ctx.app.request("/api/dashboard/subscribers");

      expect(res.status).toBe(403);
    });

    it("returns 401 for unauthenticated request", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/dashboard/subscribers");

      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/dashboard/bookings ──

  describe("GET /api/dashboard/bookings", () => {
    it("returns pending and total booking counts", async () => {
      // First .from() call (total count) — terminal, no .where()
      // Second .from() call (pending count) — chains to .where()
      mockSelectFrom
        .mockImplementationOnce(() => {
          // Total count — terminal (no .where())
          return Promise.resolve([{ count: 10 }]);
        })
        .mockImplementationOnce(() => {
          // Pending count — chains to .where()
          return { where: mockSelectWhere };
        });
      mockSelectWhere.mockResolvedValue([{ count: 3 }]);

      const res = await ctx.app.request("/api/dashboard/bookings");
      const body = (await res.json()) as { pending: number; total: number };

      expect(res.status).toBe(200);
      expect(body.total).toBe(10);
      expect(body.pending).toBe(3);
    });

    it("returns { pending: 0, total: 0 } when no bookings", async () => {
      // Default mock returns [{ count: 0 }] for both paths
      const res = await ctx.app.request("/api/dashboard/bookings");
      const body = (await res.json()) as { pending: number; total: number };

      expect(res.status).toBe(200);
      expect(body.pending).toBe(0);
      expect(body.total).toBe(0);
    });

    it("returns 403 for non-cooperative-member", async () => {
      ctx.auth.roles = ["subscriber"];

      const res = await ctx.app.request("/api/dashboard/bookings");

      expect(res.status).toBe(403);
    });

    it("returns 401 for unauthenticated request", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/dashboard/bookings");

      expect(res.status).toBe(401);
    });
  });
});
