import { describe, it, expect, vi, afterEach } from "vitest";
import Stripe from "stripe";

import { TEST_CONFIG } from "../helpers/test-constants.js";

// ── Mock State ──
// Individual method stubs allow per-test return-value control

const mockCustomersSearch = vi.fn();
const mockCustomersCreate = vi.fn();
const mockCheckoutSessionsCreate = vi.fn();
const mockSubscriptionsUpdate = vi.fn();
const mockWebhooksConstructEvent = vi.fn();

const mockStripeInstance = {
  customers: {
    search: mockCustomersSearch,
    create: mockCustomersCreate,
  },
  checkout: {
    sessions: {
      create: mockCheckoutSessionsCreate,
    },
  },
  subscriptions: {
    update: mockSubscriptionsUpdate,
  },
  webhooks: {
    constructEvent: mockWebhooksConstructEvent,
  },
};

// ── Setup Factory ──

const setupStripeService = async () => {
  vi.doMock("../../src/services/stripe-client.js", () => ({
    getStripe: () => ({ ok: true, value: mockStripeInstance }),
  }));

  vi.doMock("../../src/config.js", () => ({
    config: TEST_CONFIG,
  }));

  return await import("../../src/services/stripe.js");
};

const setupStripeServiceUnconfigured = async () => {
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

  vi.doMock("../../src/config.js", () => ({
    config: { ...TEST_CONFIG, STRIPE_SECRET_KEY: undefined },
  }));

  return await import("../../src/services/stripe.js");
};

// ── Tests ──

describe("stripe service", () => {
  afterEach(() => {
    vi.resetModules();
  });

  describe("getOrCreateCustomer", () => {
    it("returns existing customer ID when search finds a match", async () => {
      mockCustomersSearch.mockResolvedValue({ data: [{ id: "cus_existing" }] });

      const { getOrCreateCustomer } = await setupStripeService();
      const result = await getOrCreateCustomer("user_123", "user@example.com");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("cus_existing");
      }
      expect(mockCustomersCreate).not.toHaveBeenCalled();
    });

    it("creates new customer when search returns empty", async () => {
      mockCustomersSearch.mockResolvedValue({ data: [] });
      mockCustomersCreate.mockResolvedValue({ id: "cus_new" });

      const { getOrCreateCustomer } = await setupStripeService();
      const result = await getOrCreateCustomer("user_123", "user@example.com");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("cus_new");
      }
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        email: "user@example.com",
        metadata: { sncUserId: "user_123" },
      });
    });

    it("passes correct metadata to customer search", async () => {
      mockCustomersSearch.mockResolvedValue({ data: [{ id: "cus_existing" }] });

      const { getOrCreateCustomer } = await setupStripeService();
      await getOrCreateCustomer("user_abc", "user@example.com");

      expect(mockCustomersSearch).toHaveBeenCalledWith({
        query: `metadata["sncUserId"]:"user_abc"`,
      });
    });

    it("returns err on Stripe API failure", async () => {
      mockCustomersSearch.mockRejectedValue(new Error("Stripe network error"));

      const { getOrCreateCustomer } = await setupStripeService();
      const result = await getOrCreateCustomer("user_123", "user@example.com");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.code).toBe("STRIPE_ERROR");
        expect(result.error.statusCode).toBe(502);
        expect(result.error.message).toBe("Stripe network error");
      }
    });

    it("returns err when Stripe is not configured", async () => {
      const { getOrCreateCustomer } = await setupStripeServiceUnconfigured();
      const result = await getOrCreateCustomer("user_123", "user@example.com");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("BILLING_NOT_CONFIGURED");
        expect(result.error.statusCode).toBe(503);
      }
    });
  });

  describe("createCheckoutSession", () => {
    const params = {
      customerId: "cus_123",
      planStripePriceId: "price_abc",
      userId: "user_123",
      planId: "plan_xyz",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    };

    it("returns checkout URL on success", async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/pay/cs_test_abc",
      });

      const { createCheckoutSession } = await setupStripeService();
      const result = await createCheckoutSession(params);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("https://checkout.stripe.com/pay/cs_test_abc");
      }
    });

    it("passes correct parameters to Stripe", async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/pay/cs_test_abc",
      });

      const { createCheckoutSession } = await setupStripeService();
      await createCheckoutSession(params);

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith({
        customer: "cus_123",
        mode: "subscription",
        line_items: [{ price: "price_abc", quantity: 1 }],
        metadata: { userId: "user_123", planId: "plan_xyz" },
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
      });
    });

    it("returns err when session URL is null", async () => {
      mockCheckoutSessionsCreate.mockResolvedValue({ url: null });

      const { createCheckoutSession } = await setupStripeService();
      const result = await createCheckoutSession(params);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STRIPE_ERROR");
      }
    });

    it("returns err on Stripe API failure", async () => {
      mockCheckoutSessionsCreate.mockRejectedValue(new Error("API error"));

      const { createCheckoutSession } = await setupStripeService();
      const result = await createCheckoutSession(params);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.code).toBe("STRIPE_ERROR");
      }
    });
  });

  describe("cancelSubscriptionAtPeriodEnd", () => {
    it("calls subscriptions.update with cancel_at_period_end true", async () => {
      mockSubscriptionsUpdate.mockResolvedValue({});

      const { cancelSubscriptionAtPeriodEnd } = await setupStripeService();
      const result = await cancelSubscriptionAtPeriodEnd("sub_123");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeUndefined();
      }
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_123", {
        cancel_at_period_end: true,
      });
    });

    it("returns err on Stripe API failure", async () => {
      mockSubscriptionsUpdate.mockRejectedValue(new Error("Not found"));

      const { cancelSubscriptionAtPeriodEnd } = await setupStripeService();
      const result = await cancelSubscriptionAtPeriodEnd("sub_123");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.code).toBe("STRIPE_ERROR");
      }
    });
  });

  describe("verifyWebhookSignature", () => {
    it("returns parsed event on valid signature", async () => {
      const fakeEvent = {
        id: "evt_test",
        type: "invoice.paid",
        data: { object: {} },
      };
      mockWebhooksConstructEvent.mockReturnValue(fakeEvent);

      const { verifyWebhookSignature } = await setupStripeService();
      const result = verifyWebhookSignature("rawBody", "sig_header");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(fakeEvent);
      }
    });

    it("uses config.STRIPE_WEBHOOK_SECRET for verification", async () => {
      const fakeEvent = { id: "evt_test", type: "invoice.paid" };
      mockWebhooksConstructEvent.mockReturnValue(fakeEvent);

      const { verifyWebhookSignature } = await setupStripeService();
      verifyWebhookSignature("rawBody", "sig_header");

      expect(mockWebhooksConstructEvent).toHaveBeenCalledWith(
        "rawBody",
        "sig_header",
        TEST_CONFIG.STRIPE_WEBHOOK_SECRET,
      );
    });

    it("returns err on invalid signature", async () => {
      mockWebhooksConstructEvent.mockImplementation(() => {
        throw new Error("Invalid sig");
      });

      const { verifyWebhookSignature } = await setupStripeService();
      const result = verifyWebhookSignature("rawBody", "bad_sig");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("WEBHOOK_SIGNATURE_ERROR");
        expect(result.error.statusCode).toBe(400);
      }
    });
  });

  describe("granular error mapping", () => {
    it("maps StripeCardError to 400 with STRIPE_CARD_ERROR code", async () => {
      mockCustomersSearch.mockRejectedValue(
        new Stripe.errors.StripeCardError({ message: "Card declined" }),
      );

      const { getOrCreateCustomer } = await setupStripeService();
      const result = await getOrCreateCustomer("user_123", "u@example.com");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STRIPE_CARD_ERROR");
        expect(result.error.statusCode).toBe(400);
      }
    });

    it("maps StripeInvalidRequestError to 400", async () => {
      mockCheckoutSessionsCreate.mockRejectedValue(
        new Stripe.errors.StripeInvalidRequestError({
          message: "Invalid price",
        }),
      );

      const { createCheckoutSession } = await setupStripeService();
      const result = await createCheckoutSession({
        customerId: "cus_1",
        planStripePriceId: "price_bad",
        userId: "u1",
        planId: "p1",
        successUrl: "https://example.com/ok",
        cancelUrl: "https://example.com/cancel",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STRIPE_INVALID_REQUEST");
        expect(result.error.statusCode).toBe(400);
      }
    });

    it("maps StripeRateLimitError to 429", async () => {
      mockSubscriptionsUpdate.mockRejectedValue(
        new Stripe.errors.StripeRateLimitError({
          message: "Too many requests",
        }),
      );

      const { cancelSubscriptionAtPeriodEnd } = await setupStripeService();
      const result = await cancelSubscriptionAtPeriodEnd("sub_123");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STRIPE_RATE_LIMIT");
        expect(result.error.statusCode).toBe(429);
      }
    });

    it("maps StripeAuthenticationError to 500", async () => {
      mockCustomersSearch.mockRejectedValue(
        new Stripe.errors.StripeAuthenticationError({
          message: "Invalid API key",
        }),
      );

      const { getOrCreateCustomer } = await setupStripeService();
      const result = await getOrCreateCustomer("user_123", "u@example.com");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STRIPE_AUTH_ERROR");
        expect(result.error.statusCode).toBe(500);
      }
    });

    it("maps StripeConnectionError to 502", async () => {
      mockCustomersSearch.mockRejectedValue(
        new Stripe.errors.StripeConnectionError({
          message: "Connection refused",
        }),
      );

      const { getOrCreateCustomer } = await setupStripeService();
      const result = await getOrCreateCustomer("user_123", "u@example.com");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STRIPE_CONNECTION_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });

    it("maps StripeAPIError to 502", async () => {
      mockCustomersSearch.mockRejectedValue(
        new Stripe.errors.StripeAPIError({
          message: "Internal Stripe error",
        }),
      );

      const { getOrCreateCustomer } = await setupStripeService();
      const result = await getOrCreateCustomer("user_123", "u@example.com");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STRIPE_API_ERROR");
        expect(result.error.statusCode).toBe(502);
      }
    });
  });
});
