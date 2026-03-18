import { describe, it, expect } from "vitest";

import {
  fetchPlans,
  createCheckout,
  fetchMySubscriptions,
  hasPlatformSubscription,
  cancelSubscription,
} from "../../../src/lib/subscription.js";
import {
  makeMockPlan,
  makeMockUserSubscription,
} from "../../helpers/subscription-fixtures.js";
import { setupFetchMock } from "../../helpers/fetch-mock.js";

// ── Test Lifecycle ──

const { getMockFetch } = setupFetchMock();

// ── fetchPlans ──

describe("fetchPlans", () => {
  it("fetches from correct URL and unwraps plans", async () => {
    const plans = [makeMockPlan()];
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ plans }), { status: 200 }),
    );

    const result = await fetchPlans();

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/subscriptions/plans",
      { credentials: "include" },
    );
    expect(result).toEqual(plans);
  });

  it("passes type as query parameter", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ plans: [] }), { status: 200 }),
    );

    await fetchPlans({ type: "platform" });

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/subscriptions/plans?type=platform",
      { credentials: "include" },
    );
  });

  it("passes creatorId as query parameter", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ plans: [] }), { status: 200 }),
    );

    await fetchPlans({ creatorId: "user_abc" });

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/subscriptions/plans?creatorId=user_abc",
      { credentials: "include" },
    );
  });

  it("passes both type and creatorId", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ plans: [] }), { status: 200 }),
    );

    await fetchPlans({ type: "creator", creatorId: "user_abc" });

    const calledUrl = getMockFetch().mock.calls[0]![0] as string;
    const params = new URLSearchParams(calledUrl.split("?")[1]);
    expect(params.get("type")).toBe("creator");
    expect(params.get("creatorId")).toBe("user_abc");
  });

  it("omits undefined parameters", async () => {
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ plans: [] }), { status: 200 }),
    );

    await fetchPlans({ creatorId: "user_abc" });

    const calledUrl = getMockFetch().mock.calls[0]![0] as string;
    const params = new URLSearchParams(calledUrl.split("?")[1]);
    expect(params.has("type")).toBe(false);
    expect(params.get("creatorId")).toBe("user_abc");
  });

  it("throws on error response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Service unavailable" } }),
        { status: 503 },
      ),
    );

    await expect(fetchPlans()).rejects.toThrow("Service unavailable");
  });
});

// ── createCheckout ──

describe("createCheckout", () => {
  it("posts planId and returns checkout URL", async () => {
    const checkoutUrl = "https://checkout.stripe.com/c/pay_xxx";
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ checkoutUrl }), { status: 200 }),
    );

    const result = await createCheckout("plan_test_platform_monthly");

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/subscriptions/checkout",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "plan_test_platform_monthly" }),
      },
    );
    expect(result).toBe(checkoutUrl);
  });

  it("throws on 401 unauthenticated", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Unauthorized" } }),
        { status: 401 },
      ),
    );

    await expect(createCheckout("plan_xxx")).rejects.toThrow("Unauthorized");
  });
});

// ── fetchMySubscriptions ──

describe("fetchMySubscriptions", () => {
  it("fetches from correct URL and unwraps subscriptions", async () => {
    const subscriptions = [makeMockUserSubscription()];
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ subscriptions }), { status: 200 }),
    );

    const result = await fetchMySubscriptions();

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/subscriptions/mine",
      { credentials: "include" },
    );
    expect(result).toEqual(subscriptions);
  });

  it("passes abort signal through", async () => {
    const subscriptions = [makeMockUserSubscription()];
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ subscriptions }), { status: 200 }),
    );

    const controller = new AbortController();
    await fetchMySubscriptions(controller.signal);

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/subscriptions/mine",
      { credentials: "include", signal: controller.signal },
    );
  });

  it("throws on error response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Unauthorized" } }),
        { status: 401 },
      ),
    );

    await expect(fetchMySubscriptions()).rejects.toThrow("Unauthorized");
  });
});

// ── hasPlatformSubscription ──

describe("hasPlatformSubscription", () => {
  it("returns true for active platform subscription", () => {
    const subs = [makeMockUserSubscription({ status: "active" })];
    expect(hasPlatformSubscription(subs)).toBe(true);
  });

  it("returns false for inactive platform subscription", () => {
    const subs = [makeMockUserSubscription({ status: "canceled" })];
    expect(hasPlatformSubscription(subs)).toBe(false);
  });

  it("returns false for active creator subscription", () => {
    const subs = [
      makeMockUserSubscription({
        status: "active",
        plan: {
          ...makeMockPlan(),
          type: "creator",
          creatorId: "user_abc",
        },
      }),
    ];
    expect(hasPlatformSubscription(subs)).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(hasPlatformSubscription([])).toBe(false);
  });

  it("returns true when mixed subscriptions include active platform", () => {
    const subs = [
      makeMockUserSubscription({
        status: "canceled",
        plan: { ...makeMockPlan(), id: "plan_old" },
      }),
      makeMockUserSubscription({
        status: "active",
        plan: { ...makeMockPlan(), type: "creator", creatorId: "user_abc" },
      }),
      makeMockUserSubscription({ status: "active" }),
    ];
    expect(hasPlatformSubscription(subs)).toBe(true);
  });
});

// ── cancelSubscription ──

describe("cancelSubscription", () => {
  it("posts subscriptionId and returns updated subscription", async () => {
    const subscription = makeMockUserSubscription({
      cancelAtPeriodEnd: true,
    });
    getMockFetch().mockResolvedValue(
      new Response(JSON.stringify({ subscription }), { status: 200 }),
    );

    const result = await cancelSubscription("sub_record_test_xxx");

    expect(getMockFetch()).toHaveBeenCalledWith(
      "/api/subscriptions/cancel",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: "sub_record_test_xxx" }),
      },
    );
    expect(result).toEqual(subscription);
  });

  it("throws on error response", async () => {
    getMockFetch().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Subscription not found" } }),
        { status: 404 },
      ),
    );

    await expect(cancelSubscription("sub_xxx")).rejects.toThrow(
      "Subscription not found",
    );
  });
});
