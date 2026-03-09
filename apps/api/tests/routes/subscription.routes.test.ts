import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import { makeMockUser, makeMockSession } from "../helpers/auth-fixtures.js";
import {
  makeMockPlan,
  makeMockSubscription,
} from "../helpers/subscription-fixtures.js";
import { chainablePromise } from "../helpers/db-mock-utils.js";

// ── Mock DB Chains ──

// SELECT: db.select().from(table).where(...)
const mockSelectWhere = vi.fn();
const mockJoinWhere = vi.fn();
const mockInnerJoin = vi.fn(() => ({ where: mockJoinWhere }));
const mockSelectFrom = vi.fn(() => ({
  where: mockSelectWhere,
  innerJoin: mockInnerJoin,
}));
const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

// UPDATE: db.update(table).set({...}).where(...).returning()
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn(() =>
  chainablePromise(undefined, { returning: mockUpdateReturning }),
);
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

const mockDb = {
  select: mockSelect,
  update: mockUpdate,
};

// ── Mock Stripe Service ──

const mockGetOrCreateCustomer = vi.fn();
const mockCreateCheckoutSession = vi.fn();
const mockCancelSubscriptionAtPeriodEnd = vi.fn();

// ── Test Setup ──

const ctx = setupRouteTest({
  db: mockDb,
  mockRole: false,
  mocks: () => {
    vi.doMock("../../src/db/schema/subscription.schema.js", () => ({
      subscriptionPlans: {
        id: {},
        name: {},
        type: {},
        creatorId: {},
        stripePriceId: {},
        price: {},
        interval: {},
        active: {},
        createdAt: {},
        updatedAt: {},
      },
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
    }));

    vi.doMock("../../src/services/stripe.js", () => ({
      getOrCreateCustomer: mockGetOrCreateCustomer,
      createCheckoutSession: mockCreateCheckoutSession,
      cancelSubscriptionAtPeriodEnd: mockCancelSubscriptionAtPeriodEnd,
    }));
  },
  mountRoute: async (app) => {
    const { subscriptionRoutes } = await import(
      "../../src/routes/subscription.routes.js"
    );
    app.route("/api/subscriptions", subscriptionRoutes);
  },
  beforeEach: () => {
    // Default DB responses
    mockSelectWhere.mockResolvedValue([]);
    mockJoinWhere.mockResolvedValue([]);
    mockUpdateReturning.mockResolvedValue([]);

    // Default Stripe service responses
    mockGetOrCreateCustomer.mockResolvedValue({ ok: true, value: "cus_test" });
    mockCreateCheckoutSession.mockResolvedValue({
      ok: true,
      value: "https://checkout.stripe.com/test",
    });
    mockCancelSubscriptionAtPeriodEnd.mockResolvedValue({
      ok: true,
      value: undefined,
    });
  },
});

// ── Tests ──

describe("subscription routes", () => {
  // ── GET /api/subscriptions/plans ──

  describe("GET /api/subscriptions/plans", () => {
    it("returns active plans", async () => {
      const plan = makeMockPlan();
      mockSelectWhere.mockResolvedValue([plan]);

      const res = await ctx.app.request("/api/subscriptions/plans");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.plans).toHaveLength(1);
      expect(body.plans[0].id).toBe(plan.id);
      expect(body.plans[0].name).toBe(plan.name);
      expect(body.plans[0].type).toBe(plan.type);
    });

    it("returns empty array when no active plans", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/subscriptions/plans");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.plans).toEqual([]);
    });

    it("filters by type=platform", async () => {
      const plan = makeMockPlan({ type: "platform" });
      mockSelectWhere.mockResolvedValue([plan]);

      const res = await ctx.app.request("/api/subscriptions/plans?type=platform");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.plans).toHaveLength(1);
      expect(body.plans[0].type).toBe("platform");
    });

    it("filters by creatorId", async () => {
      const plan = makeMockPlan({ type: "creator", creatorId: "user_c1" });
      mockSelectWhere.mockResolvedValue([plan]);

      const res = await ctx.app.request(
        "/api/subscriptions/plans?creatorId=user_c1",
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.plans).toHaveLength(1);
      expect(body.plans[0].creatorId).toBe("user_c1");
    });

    it("excludes inactive plans (handler always adds active=true condition)", async () => {
      // The handler always pushes active=true into the WHERE conditions.
      // The DB mock returns [] simulating no active plans.
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/subscriptions/plans");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.plans).toEqual([]);
    });

    it("converts Date timestamps to ISO strings", async () => {
      const plan = makeMockPlan();
      mockSelectWhere.mockResolvedValue([plan]);

      const res = await ctx.app.request("/api/subscriptions/plans");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(typeof body.plans[0].createdAt).toBe("string");
      expect(typeof body.plans[0].updatedAt).toBe("string");
      expect(body.plans[0].createdAt).toBe(plan.createdAt.toISOString());
    });
  });

  // ── POST /api/subscriptions/checkout ──

  describe("POST /api/subscriptions/checkout", () => {
    it("creates checkout session and returns URL", async () => {
      mockSelectWhere.mockResolvedValue([makeMockPlan()]);

      const res = await ctx.app.request("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "plan_test_platform_monthly" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.checkoutUrl).toBe("https://checkout.stripe.com/test");
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "plan_test_platform_monthly" }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 400 for non-existent plan", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "plan_nonexistent" }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for inactive plan (filtered by WHERE active=true)", async () => {
      // inactive plans are excluded by the query; the mock returns empty
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "plan_inactive" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for empty planId", async () => {
      const res = await ctx.app.request("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "" }),
      });

      expect(res.status).toBe(400);
    });

    it("passes correct parameters to getOrCreateCustomer", async () => {
      const user = makeMockUser();
      ctx.auth.user = user;
      mockSelectWhere.mockResolvedValue([makeMockPlan()]);

      await ctx.app.request("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "plan_test_platform_monthly" }),
      });

      expect(mockGetOrCreateCustomer).toHaveBeenCalledWith(
        user.id,
        user.email,
      );
    });

    it("passes correct parameters to createCheckoutSession", async () => {
      const plan = makeMockPlan();
      mockSelectWhere.mockResolvedValue([plan]);

      await ctx.app.request("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });

      expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: "cus_test",
          planStripePriceId: plan.stripePriceId,
          userId: ctx.auth.user!.id,
          planId: plan.id,
          successUrl: expect.stringContaining("/checkout/success"),
          cancelUrl: expect.stringContaining("/checkout/cancel"),
        }),
      );
    });

    it("returns error when getOrCreateCustomer fails", async () => {
      const { AppError } = await import("@snc/shared");
      mockSelectWhere.mockResolvedValue([makeMockPlan()]);
      mockGetOrCreateCustomer.mockResolvedValue({
        ok: false,
        error: new AppError("STRIPE_ERROR", "fail", 502),
      });

      const res = await ctx.app.request("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "plan_test_platform_monthly" }),
      });

      expect(res.status).toBe(502);
    });

    it("returns error when createCheckoutSession fails", async () => {
      const { AppError } = await import("@snc/shared");
      mockSelectWhere.mockResolvedValue([makeMockPlan()]);
      mockCreateCheckoutSession.mockResolvedValue({
        ok: false,
        error: new AppError("STRIPE_ERROR", "fail", 502),
      });

      const res = await ctx.app.request("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "plan_test_platform_monthly" }),
      });

      expect(res.status).toBe(502);
    });
  });

  // ── POST /api/subscriptions/cancel ──

  describe("POST /api/subscriptions/cancel", () => {
    it("cancels active subscription and returns subscription with plan", async () => {
      const user = makeMockUser();
      ctx.auth.user = user;
      const plan = makeMockPlan();
      const sub = makeMockSubscription({ userId: user.id });
      const updatedSub = makeMockSubscription({
        userId: user.id,
        cancelAtPeriodEnd: true,
      });

      mockSelectWhere
        .mockResolvedValueOnce([sub])
        .mockResolvedValueOnce([plan]);
      mockUpdateReturning.mockResolvedValue([updatedSub]);

      const res = await ctx.app.request("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: sub.id }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.subscription.cancelAtPeriodEnd).toBe(true);
      expect(body.subscription.plan).toBeDefined();
      expect(body.subscription.plan.id).toBe(plan.id);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: "sub_record_test_xxx" }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 404 for non-existent subscription", async () => {
      mockSelectWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: "sub_nonexistent" }),
      });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error.code).toBe("NOT_FOUND");
    });

    it("returns 403 for non-owner", async () => {
      const user = makeMockUser();
      ctx.auth.user = user;
      mockSelectWhere.mockResolvedValue([
        makeMockSubscription({ userId: "other_user" }),
      ]);

      const res = await ctx.app.request("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: "sub_record_test_xxx" }),
      });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("returns 400 for already-canceled subscription", async () => {
      const user = makeMockUser();
      ctx.auth.user = user;
      mockSelectWhere.mockResolvedValue([
        makeMockSubscription({ userId: user.id, status: "canceled" }),
      ]);

      const res = await ctx.app.request("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: "sub_record_test_xxx" }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for subscription already set to cancel at period end", async () => {
      const user = makeMockUser();
      ctx.auth.user = user;
      mockSelectWhere.mockResolvedValue([
        makeMockSubscription({ userId: user.id, cancelAtPeriodEnd: true }),
      ]);

      const res = await ctx.app.request("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: "sub_record_test_xxx" }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 for past_due subscription", async () => {
      const user = makeMockUser();
      ctx.auth.user = user;
      mockSelectWhere.mockResolvedValue([
        makeMockSubscription({ userId: user.id, status: "past_due" }),
      ]);

      const res = await ctx.app.request("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: "sub_record_test_xxx" }),
      });

      expect(res.status).toBe(400);
    });

    it("calls cancelSubscriptionAtPeriodEnd with Stripe subscription ID", async () => {
      const user = makeMockUser();
      ctx.auth.user = user;
      const sub = makeMockSubscription({ userId: user.id });
      const plan = makeMockPlan();

      mockSelectWhere
        .mockResolvedValueOnce([sub])
        .mockResolvedValueOnce([plan]);
      mockUpdateReturning.mockResolvedValue([
        makeMockSubscription({ userId: user.id, cancelAtPeriodEnd: true }),
      ]);

      await ctx.app.request("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: sub.id }),
      });

      expect(mockCancelSubscriptionAtPeriodEnd).toHaveBeenCalledWith(
        sub.stripeSubscriptionId,
      );
    });

    it("updates DB with cancelAtPeriodEnd = true", async () => {
      const user = makeMockUser();
      ctx.auth.user = user;
      const sub = makeMockSubscription({ userId: user.id });
      const plan = makeMockPlan();

      mockSelectWhere
        .mockResolvedValueOnce([sub])
        .mockResolvedValueOnce([plan]);
      mockUpdateReturning.mockResolvedValue([
        makeMockSubscription({ userId: user.id, cancelAtPeriodEnd: true }),
      ]);

      await ctx.app.request("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: sub.id }),
      });

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ cancelAtPeriodEnd: true }),
      );
    });

    it("returns error when Stripe cancel fails", async () => {
      const { AppError } = await import("@snc/shared");
      const user = makeMockUser();
      ctx.auth.user = user;
      mockSelectWhere.mockResolvedValue([
        makeMockSubscription({ userId: user.id }),
      ]);
      mockCancelSubscriptionAtPeriodEnd.mockResolvedValue({
        ok: false,
        error: new AppError("STRIPE_ERROR", "fail", 502),
      });

      const res = await ctx.app.request("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: "sub_record_test_xxx" }),
      });

      expect(res.status).toBe(502);
    });

    it("returns 404 when subscription plan is not found after cancel", async () => {
      const user = makeMockUser();
      ctx.auth.user = user;
      const sub = makeMockSubscription({ userId: user.id });

      mockSelectWhere
        .mockResolvedValueOnce([sub]) // subscription lookup
        .mockResolvedValueOnce([]); // plan lookup returns nothing
      mockUpdateReturning.mockResolvedValue([
        makeMockSubscription({ userId: user.id, cancelAtPeriodEnd: true }),
      ]);

      const res = await ctx.app.request("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: sub.id }),
      });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  // ── GET /api/subscriptions/mine ──

  describe("GET /api/subscriptions/mine", () => {
    it("returns subscriptions with plan details", async () => {
      const user = makeMockUser();
      ctx.auth.user = user;
      const sub = makeMockSubscription({ userId: user.id });
      const plan = makeMockPlan();

      mockJoinWhere.mockResolvedValue([
        { user_subscriptions: sub, subscription_plans: plan },
      ]);

      const res = await ctx.app.request("/api/subscriptions/mine");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.subscriptions).toHaveLength(1);
      expect(body.subscriptions[0].id).toBe(sub.id);
      expect(body.subscriptions[0].plan).toBeDefined();
      expect(body.subscriptions[0].plan.id).toBe(plan.id);
    });

    it("returns empty array for user with no subscriptions", async () => {
      mockJoinWhere.mockResolvedValue([]);

      const res = await ctx.app.request("/api/subscriptions/mine");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.subscriptions).toEqual([]);
    });

    it("returns 401 when unauthenticated", async () => {
      ctx.auth.user = null;

      const res = await ctx.app.request("/api/subscriptions/mine");

      expect(res.status).toBe(401);
    });

    it("returns multiple subscriptions when user has several", async () => {
      const user = makeMockUser();
      ctx.auth.user = user;

      mockJoinWhere.mockResolvedValue([
        {
          user_subscriptions: makeMockSubscription({
            id: "sub1",
            userId: user.id,
          }),
          subscription_plans: makeMockPlan(),
        },
        {
          user_subscriptions: makeMockSubscription({
            id: "sub2",
            userId: user.id,
          }),
          subscription_plans: makeMockPlan({
            id: "plan2",
            type: "creator",
            creatorId: "creator_x",
          }),
        },
      ]);

      const res = await ctx.app.request("/api/subscriptions/mine");
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.subscriptions).toHaveLength(2);
      expect(body.subscriptions[0].id).toBe("sub1");
      expect(body.subscriptions[1].id).toBe("sub2");
    });

    it("converts Date timestamps to ISO strings in response", async () => {
      const user = makeMockUser();
      ctx.auth.user = user;
      const sub = makeMockSubscription({ userId: user.id });
      const plan = makeMockPlan();

      mockJoinWhere.mockResolvedValue([
        { user_subscriptions: sub, subscription_plans: plan },
      ]);

      const res = await ctx.app.request("/api/subscriptions/mine");
      const body = await res.json();

      expect(res.status).toBe(200);
      const s = body.subscriptions[0];
      expect(typeof s.createdAt).toBe("string");
      expect(typeof s.updatedAt).toBe("string");
      expect(typeof s.plan.createdAt).toBe("string");
      expect(typeof s.plan.updatedAt).toBe("string");
      expect(s.createdAt).toBe(sub.createdAt.toISOString());
      expect(s.plan.createdAt).toBe(plan.createdAt.toISOString());
    });
  });
});
