import { describe, it, expect, vi, afterEach } from "vitest";

import { TEST_CONFIG } from "../helpers/test-constants.js";
import { makeMockStripeInvoice } from "../helpers/dashboard-fixtures.js";

// ── Helpers ──

const makeAsyncIterable = (items: unknown[]) => ({
  async *[Symbol.asyncIterator]() {
    for (const item of items) {
      yield item;
    }
  },
});

// ── Mock State ──

const mockInvoicesList = vi.fn();

const mockStripeInstance = {
  invoices: {
    list: mockInvoicesList,
  },
};

// ── Setup Factories ──

const setupRevenueService = async () => {
  vi.doMock("../../src/services/stripe-client.js", () => ({
    getStripe: () => ({ ok: true, value: mockStripeInstance }),
  }));

  return await import("../../src/services/revenue.js");
};

const setupRevenueServiceUnconfigured = async () => {
  const { AppError, err } = await import("@snc/shared");

  vi.doMock("../../src/services/stripe-client.js", () => ({
    getStripe: () =>
      err(
        new AppError(
          "BILLING_NOT_CONFIGURED",
          "Stripe integration is not configured",
          503,
        ),
      ),
  }));

  return await import("../../src/services/revenue.js");
};

// ── Tests ──

describe("revenue service", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  describe("getMonthlyRevenue", () => {
    it("groups invoices by year and month and sums amount_paid", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));

      const invoices = [
        makeMockStripeInvoice({
          id: "in_1",
          amount_paid: 1000,
          created: Math.floor(new Date("2026-03-05T10:00:00Z").getTime() / 1000),
        }),
        makeMockStripeInvoice({
          id: "in_2",
          amount_paid: 2000,
          created: Math.floor(new Date("2026-03-10T10:00:00Z").getTime() / 1000),
        }),
        makeMockStripeInvoice({
          id: "in_3",
          amount_paid: 500,
          created: Math.floor(new Date("2026-02-15T10:00:00Z").getTime() / 1000),
        }),
      ];
      mockInvoicesList.mockReturnValue(makeAsyncIterable(invoices));

      const { getMonthlyRevenue } = await setupRevenueService();
      const result = await getMonthlyRevenue(3);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]).toEqual({ month: 3, year: 2026, amount: 3000 });
        expect(result.value[1]).toEqual({ month: 2, year: 2026, amount: 500 });
        expect(result.value[2]).toEqual({ month: 1, year: 2026, amount: 0 });
      }

      vi.useRealTimers();
    });

    it("zero-fills months with no invoices", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));

      const invoices = [
        makeMockStripeInvoice({
          id: "in_1",
          amount_paid: 1500,
          created: Math.floor(new Date("2026-03-10T10:00:00Z").getTime() / 1000),
        }),
      ];
      mockInvoicesList.mockReturnValue(makeAsyncIterable(invoices));

      const { getMonthlyRevenue } = await setupRevenueService();
      const result = await getMonthlyRevenue(3);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]).toEqual({ month: 3, year: 2026, amount: 1500 });
        expect(result.value[1]).toEqual({ month: 2, year: 2026, amount: 0 });
        expect(result.value[2]).toEqual({ month: 1, year: 2026, amount: 0 });
      }

      vi.useRealTimers();
    });

    it("returns entries in most-recent-first order", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));

      const invoices = [
        makeMockStripeInvoice({
          id: "in_1",
          amount_paid: 100,
          created: Math.floor(new Date("2026-01-10T10:00:00Z").getTime() / 1000),
        }),
        makeMockStripeInvoice({
          id: "in_2",
          amount_paid: 200,
          created: Math.floor(new Date("2026-02-10T10:00:00Z").getTime() / 1000),
        }),
        makeMockStripeInvoice({
          id: "in_3",
          amount_paid: 300,
          created: Math.floor(new Date("2026-03-10T10:00:00Z").getTime() / 1000),
        }),
      ];
      mockInvoicesList.mockReturnValue(makeAsyncIterable(invoices));

      const { getMonthlyRevenue } = await setupRevenueService();
      const result = await getMonthlyRevenue(3);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value[0]?.month).toBe(3);
        expect(result.value[0]?.year).toBe(2026);
        expect(result.value[2]?.month).toBe(1);
        expect(result.value[2]?.year).toBe(2026);
      }

      vi.useRealTimers();
    });

    it("returns exactly N entries for N months", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));

      mockInvoicesList.mockReturnValue(makeAsyncIterable([]));

      const { getMonthlyRevenue } = await setupRevenueService();
      const result = await getMonthlyRevenue(12);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(12);
      }

      vi.useRealTimers();
    });

    it("wraps unknown errors as AppError with code STRIPE_ERROR", async () => {
      mockInvoicesList.mockImplementation(() => {
        throw new Error("Stripe connection failure");
      });

      const { getMonthlyRevenue } = await setupRevenueService();
      const result = await getMonthlyRevenue(12);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STRIPE_ERROR");
        expect(result.error.statusCode).toBe(502);
        expect(result.error.message).toBe("Stripe connection failure");
      }
    });

    it("maps StripeRateLimitError to STRIPE_RATE_LIMIT 429", async () => {
      const Stripe = await import("stripe");
      mockInvoicesList.mockImplementation(() => {
        throw new Stripe.default.errors.StripeRateLimitError({
          message: "Too many requests",
        });
      });

      const { getMonthlyRevenue } = await setupRevenueService();
      const result = await getMonthlyRevenue(12);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STRIPE_RATE_LIMIT");
        expect(result.error.statusCode).toBe(429);
      }
    });

    it("handles empty invoice list (no paid invoices)", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));

      mockInvoicesList.mockReturnValue(makeAsyncIterable([]));

      const { getMonthlyRevenue } = await setupRevenueService();
      const result = await getMonthlyRevenue(3);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
        for (const entry of result.value) {
          expect(entry.amount).toBe(0);
        }
      }

      vi.useRealTimers();
    });

    it("passes correct date range and status filter to Stripe", async () => {
      vi.useFakeTimers();
      const now = new Date("2026-03-15T12:00:00Z");
      vi.setSystemTime(now);

      mockInvoicesList.mockReturnValue(makeAsyncIterable([]));

      const { getMonthlyRevenue } = await setupRevenueService();
      await getMonthlyRevenue(12);

      expect(mockInvoicesList).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "paid",
          limit: 100,
          created: expect.objectContaining({
            gte: expect.any(Number),
            lt: expect.any(Number),
          }),
        }),
      );

      const callArgs = mockInvoicesList.mock.calls[0]?.[0] as {
        created: { gte: number; lt: number };
      };
      const expectedStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12 + 1, 1),
      );
      expect(callArgs.created.gte).toBe(
        Math.floor(expectedStart.getTime() / 1000),
      );
      expect(callArgs.created.lt).toBe(Math.floor(now.getTime() / 1000));

      vi.useRealTimers();
    });

    it("returns BILLING_NOT_CONFIGURED 503 when Stripe is not configured", async () => {
      const { getMonthlyRevenue } = await setupRevenueServiceUnconfigured();
      const result = await getMonthlyRevenue(12);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("BILLING_NOT_CONFIGURED");
        expect(result.error.statusCode).toBe(503);
        expect(result.error.message).toBe(
          "Stripe integration is not configured",
        );
      }
    });

    it("handles invoices spanning a year boundary", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-15T12:00:00Z"));

      const invoices = [
        makeMockStripeInvoice({
          id: "in_dec",
          amount_paid: 800,
          created: Math.floor(new Date("2025-12-20T10:00:00Z").getTime() / 1000),
        }),
        makeMockStripeInvoice({
          id: "in_jan",
          amount_paid: 900,
          created: Math.floor(new Date("2026-01-15T10:00:00Z").getTime() / 1000),
        }),
      ];
      mockInvoicesList.mockReturnValue(makeAsyncIterable(invoices));

      const { getMonthlyRevenue } = await setupRevenueService();
      const result = await getMonthlyRevenue(3);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
        // Most recent first: Feb 2026, Jan 2026, Dec 2025
        expect(result.value[0]).toEqual({ month: 2, year: 2026, amount: 0 });
        expect(result.value[1]).toEqual({ month: 1, year: 2026, amount: 900 });
        expect(result.value[2]).toEqual({ month: 12, year: 2025, amount: 800 });
      }

      vi.useRealTimers();
    });
  });
});
