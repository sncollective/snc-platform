import { describe, it, expect, vi, afterEach } from "vitest";

// ── Setup helpers ──

const setupStripeClient = async (stripeKey: string | undefined) => {
  vi.doMock("../../src/config.js", () => ({
    config: {
      STRIPE_SECRET_KEY: stripeKey,
    },
  }));

  // Mock the Stripe constructor — must use class syntax so `new Stripe()` works
  vi.doMock("stripe", () => {
    class MockStripe {
      customers = {};
      subscriptions = {};
      constructor(_key: string) {}
    }
    return { default: MockStripe };
  });

  return await import("../../src/services/stripe-client.js");
};

// ── Tests ──

describe("stripe-client", () => {
  afterEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  describe("getStripe", () => {
    it("returns ok with a Stripe instance when STRIPE_SECRET_KEY is configured", async () => {
      const { getStripe } = await setupStripeClient("sk_test_abc123");
      const result = getStripe();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeDefined();
      }
    });

    it("returns err with BILLING_NOT_CONFIGURED when STRIPE_SECRET_KEY is undefined", async () => {
      const { getStripe } = await setupStripeClient(undefined);
      const result = getStripe();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("BILLING_NOT_CONFIGURED");
        expect(result.error.statusCode).toBe(503);
      }
    });

    it("returns the same Stripe instance on subsequent calls (singleton)", async () => {
      const { getStripe } = await setupStripeClient("sk_test_abc123");

      const first = getStripe();
      const second = getStripe();

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (first.ok && second.ok) {
        expect(first.value).toBe(second.value);
      }
    });

    it("consistently errors when key is missing on repeated calls", async () => {
      const { getStripe } = await setupStripeClient(undefined);

      const first = getStripe();
      const second = getStripe();

      expect(first.ok).toBe(false);
      expect(second.ok).toBe(false);
    });
  });
});
