import { describe, it, expect, vi } from "vitest";

import { setupRouteTest } from "../helpers/route-test-factory.js";
import {
  makeCheckoutSessionCompletedEvent,
  makeInvoicePaidEvent,
  makeInvoicePaymentFailedEvent,
  makeSubscriptionUpdatedEvent,
  makeSubscriptionDeletedEvent,
} from "../helpers/subscription-fixtures.js";

// ── Mock State ──

const mockVerifyWebhookSignature = vi.fn();

// ── Mock DB Chains ──

// INSERT: db.insert(table).values({...})
const mockInsertValues = vi.fn();
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

// UPDATE: db.update(table).set({...}).where(...)
const mockUpdateWhere = vi.fn();
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

const mockDb = {
  insert: mockInsert,
  update: mockUpdate,
};

// ── Test Setup ──

const ctx = setupRouteTest({
  db: mockDb,
  mockAuth: false,
  mockRole: false,
  defaultAuth: { user: null, session: null, roles: [] },
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
      paymentEvents: {
        id: {},
        type: {},
        processedAt: {},
      },
    }));

    vi.doMock("../../src/services/stripe.js", () => ({
      verifyWebhookSignature: mockVerifyWebhookSignature,
    }));
  },
  mountRoute: async (app) => {
    const { webhookRoutes } = await import("../../src/routes/webhook.routes.js");
    app.route("/api/webhooks", webhookRoutes);
  },
  beforeEach: () => {
    // Default: signature verification succeeds with a checkout event
    mockVerifyWebhookSignature.mockReturnValue({
      ok: true,
      value: makeCheckoutSessionCompletedEvent(),
    });

    // Default: DB operations succeed
    mockInsertValues.mockResolvedValue(undefined);
    mockUpdateWhere.mockResolvedValue(undefined);
  },
});

// ── Helper ──

/**
 * Convenience function to POST to the webhook endpoint with a raw body
 * and stripe-signature header.
 */
const postWebhook = (
  body: string,
  signature: string = "sig_test",
) =>
  ctx.app.request("/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body,
  });

// ── Tests ──

describe("webhook routes", () => {
  describe("POST /api/webhooks/stripe", () => {
    describe("signature verification", () => {
      it("returns 400 when signature verification fails", async () => {
        const { AppError } = await import("@snc/shared");
        mockVerifyWebhookSignature.mockReturnValue({
          ok: false,
          error: new AppError("WEBHOOK_SIGNATURE_ERROR", "Invalid signature", 400),
        });

        const res = await postWebhook('{"id":"evt_bad"}', "bad_sig");
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error.code).toBe("WEBHOOK_SIGNATURE_ERROR");
      });

      it("reads raw body via text for signature verification", async () => {
        const rawBody = JSON.stringify(makeCheckoutSessionCompletedEvent());

        await postWebhook(rawBody, "test_sig_123");

        expect(mockVerifyWebhookSignature).toHaveBeenCalledWith(
          rawBody,
          "test_sig_123",
        );
        // The first argument must be a string (not parsed JSON)
        const [firstArg] = mockVerifyWebhookSignature.mock.calls[0] as [unknown, unknown];
        expect(typeof firstArg).toBe("string");
      });

      it("passes stripe-signature header to verification", async () => {
        const rawBody = JSON.stringify(makeCheckoutSessionCompletedEvent());

        await postWebhook(rawBody, "test_sig_123");

        const [, sigArg] = mockVerifyWebhookSignature.mock.calls[0] as [unknown, string];
        expect(sigArg).toBe("test_sig_123");
      });
    });

    describe("idempotency", () => {
      it("returns 200 for duplicate event ID (already processed)", async () => {
        const pgError = Object.assign(new Error("duplicate key"), { code: "23505" });
        mockInsertValues.mockRejectedValue(pgError);

        const res = await postWebhook(
          JSON.stringify(makeCheckoutSessionCompletedEvent()),
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.received).toBe(true);
      });

      it("inserts event into payment_events table on first processing", async () => {
        const event = makeCheckoutSessionCompletedEvent();

        const res = await postWebhook(JSON.stringify(event));

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalled();
        // First insert call is for paymentEvents
        const firstInsertValues = mockInsertValues.mock.calls[0] as [{ id: string; type: string }];
        expect(firstInsertValues[0]).toMatchObject({
          id: event.id,
          type: event.type,
        });
      });
    });

    describe("checkout.session.completed", () => {
      it("creates user_subscriptions row with status active", async () => {
        const event = makeCheckoutSessionCompletedEvent();
        mockVerifyWebhookSignature.mockReturnValue({ ok: true, value: event });

        const res = await postWebhook(JSON.stringify(event));

        expect(res.status).toBe(200);
        // Two inserts: paymentEvents + userSubscriptions
        expect(mockInsert).toHaveBeenCalledTimes(2);
        const secondInsertValues = mockInsertValues.mock.calls[1] as [Record<string, unknown>];
        expect(secondInsertValues[0]).toMatchObject({
          userId: "user_test_xxx",
          planId: "plan_test_platform_monthly",
          stripeSubscriptionId: "sub_test_xxxxxxxxxxxx",
          stripeCustomerId: "cus_test_xxxxxxxxxxxx",
          status: "active",
        });
      });

      it("extracts userId and planId from session metadata", async () => {
        const event = makeCheckoutSessionCompletedEvent({
          data: {
            object: {
              id: "cs_custom",
              customer: "cus_custom",
              subscription: "sub_custom",
              metadata: { userId: "user_custom_123", planId: "plan_custom_456" },
              status: "complete",
            },
          },
        });
        mockVerifyWebhookSignature.mockReturnValue({ ok: true, value: event });

        await postWebhook(JSON.stringify(event));

        const secondInsertValues = mockInsertValues.mock.calls[1] as [Record<string, unknown>];
        expect(secondInsertValues[0]).toMatchObject({
          userId: "user_custom_123",
          planId: "plan_custom_456",
        });
      });

      it("returns 200 without creating subscription when metadata is missing", async () => {
        const event = makeCheckoutSessionCompletedEvent({
          data: {
            object: {
              id: "cs_no_meta",
              customer: "cus_test_xxxxxxxxxxxx",
              subscription: "sub_test_xxxxxxxxxxxx",
              metadata: {},
              status: "complete",
            },
          },
        });
        mockVerifyWebhookSignature.mockReturnValue({ ok: true, value: event });

        const res = await postWebhook(JSON.stringify(event));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.received).toBe(true);
        // Only paymentEvents insert was called, not userSubscriptions
        expect(mockInsert).toHaveBeenCalledTimes(1);
      });
    });

    describe("invoice.paid", () => {
      it("updates subscription status to active and sets currentPeriodEnd", async () => {
        const event = makeInvoicePaidEvent();
        mockVerifyWebhookSignature.mockReturnValue({ ok: true, value: event });

        const res = await postWebhook(JSON.stringify(event));

        expect(res.status).toBe(200);
        expect(mockUpdate).toHaveBeenCalled();
        const setArgs = mockUpdateSet.mock.calls[0] as [Record<string, unknown>];
        expect(setArgs[0]).toMatchObject({ status: "active" });
        expect(setArgs[0].currentPeriodEnd).toBeInstanceOf(Date);
      });

      it("extracts period end from invoice line item", async () => {
        const periodEndUnix = Math.floor(Date.now() / 1000) + 2_592_000;
        const event = makeInvoicePaidEvent({
          data: {
            object: {
              parent: {
                subscription_details: {
                  subscription: "sub_test_xxxxxxxxxxxx",
                },
              },
              lines: { data: [{ period: { end: periodEndUnix } }] },
            },
          },
        });
        mockVerifyWebhookSignature.mockReturnValue({ ok: true, value: event });

        await postWebhook(JSON.stringify(event));

        const setArgs = mockUpdateSet.mock.calls[0] as [{ currentPeriodEnd: Date }];
        const expectedDate = new Date(periodEndUnix * 1000);
        expect(setArgs[0].currentPeriodEnd).toEqual(expectedDate);
      });
    });

    describe("invoice.payment_failed", () => {
      it("updates subscription status to past_due", async () => {
        const event = makeInvoicePaymentFailedEvent();
        mockVerifyWebhookSignature.mockReturnValue({ ok: true, value: event });

        const res = await postWebhook(JSON.stringify(event));

        expect(res.status).toBe(200);
        expect(mockUpdate).toHaveBeenCalled();
        const setArgs = mockUpdateSet.mock.calls[0] as [Record<string, unknown>];
        expect(setArgs[0]).toMatchObject({ status: "past_due" });
      });
    });

    describe("customer.subscription.updated", () => {
      it("syncs status, currentPeriodEnd, and cancelAtPeriodEnd", async () => {
        const event = makeSubscriptionUpdatedEvent();
        mockVerifyWebhookSignature.mockReturnValue({ ok: true, value: event });

        const res = await postWebhook(JSON.stringify(event));

        expect(res.status).toBe(200);
        expect(mockUpdate).toHaveBeenCalled();
        const setArgs = mockUpdateSet.mock.calls[0] as [Record<string, unknown>];
        expect(setArgs[0]).toMatchObject({
          status: "active",
          cancelAtPeriodEnd: false,
        });
        expect(setArgs[0].currentPeriodEnd).toBeInstanceOf(Date);
      });

      it("handles canceled status with cancel_at_period_end true", async () => {
        const periodEndUnix = Math.floor(Date.now() / 1000) + 2_592_000;
        const event = makeSubscriptionUpdatedEvent({
          data: {
            object: {
              id: "sub_test_xxxxxxxxxxxx",
              status: "canceled",
              items: {
                data: [{ current_period_end: periodEndUnix }],
              },
              cancel_at_period_end: true,
            },
          },
        });
        mockVerifyWebhookSignature.mockReturnValue({ ok: true, value: event });

        await postWebhook(JSON.stringify(event));

        const setArgs = mockUpdateSet.mock.calls[0] as [Record<string, unknown>];
        expect(setArgs[0]).toMatchObject({
          status: "canceled",
          cancelAtPeriodEnd: true,
        });
      });
    });

    describe("customer.subscription.deleted", () => {
      it("sets subscription status to canceled", async () => {
        const event = makeSubscriptionDeletedEvent();
        mockVerifyWebhookSignature.mockReturnValue({ ok: true, value: event });

        const res = await postWebhook(JSON.stringify(event));

        expect(res.status).toBe(200);
        expect(mockUpdate).toHaveBeenCalled();
        const setArgs = mockUpdateSet.mock.calls[0] as [Record<string, unknown>];
        expect(setArgs[0]).toMatchObject({ status: "canceled" });
      });
    });

    describe("unknown event type", () => {
      it("returns 200 without processing for unknown event types", async () => {
        const event = {
          id: "evt_unknown_123",
          type: "unknown.event.type",
          data: { object: {} },
        };
        mockVerifyWebhookSignature.mockReturnValue({ ok: true, value: event });

        const res = await postWebhook(JSON.stringify(event));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.received).toBe(true);
        // Only paymentEvents insert, no update calls
        expect(mockInsert).toHaveBeenCalledTimes(1);
        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });
  });
});
