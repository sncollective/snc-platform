// ── Private Types ──
// These mirror the shape of the Drizzle-inferred row types that the implement
// agent will create in `src/db/schema/subscription.schema.ts`. Once that schema
// exists, the overrides parameter types can be tightened to
// `Partial<typeof subscriptionPlans.$inferSelect>` etc.

type DbSubscriptionPlanRow = {
  id: string;
  name: string;
  type: "platform" | "creator";
  creatorId: string | null;
  stripePriceId: string;
  price: number;
  interval: "month" | "year";
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type DbUserSubscriptionRow = {
  id: string;
  userId: string;
  planId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: "active" | "canceled" | "past_due" | "incomplete";
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// ── DB Record Fixtures ──

export const makeMockPlan = (
  overrides?: Partial<DbSubscriptionPlanRow>,
): DbSubscriptionPlanRow => ({
  id: "plan_test_platform_monthly",
  name: "S/NC All Access",
  type: "platform",
  creatorId: null,
  stripePriceId: "price_test_platform_monthly",
  price: 999,
  interval: "month",
  active: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

export const makeMockSubscription = (
  overrides?: Partial<DbUserSubscriptionRow>,
): DbUserSubscriptionRow => ({
  id: "sub_record_test_xxx",
  userId: "user_test_xxx",
  planId: "plan_test_platform_monthly",
  stripeSubscriptionId: "sub_test_xxxxxxxxxxxx",
  stripeCustomerId: "cus_test_xxxxxxxxxxxx",
  status: "active",
  currentPeriodEnd: new Date("2026-03-01T00:00:00Z"),
  cancelAtPeriodEnd: false,
  createdAt: new Date("2026-02-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T00:00:00Z"),
  ...overrides,
});

// ── Stripe Webhook Event Fixtures ──
// Used in webhook route tests by passing to mockStripe.webhooks.constructEvent.mockReturnValue(...)

export const makeCheckoutSessionCompletedEvent = (
  overrides?: Record<string, unknown>,
) => ({
  id: "evt_test_checkout_completed",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_xxxxxxxxxxxx",
      customer: "cus_test_xxxxxxxxxxxx",
      subscription: "sub_test_xxxxxxxxxxxx",
      metadata: { userId: "user_test_xxx", planId: "plan_test_platform_monthly" },
      status: "complete",
    },
  },
  ...overrides,
});

export const makeInvoicePaidEvent = (overrides?: Record<string, unknown>) => ({
  id: "evt_test_invoice_paid",
  type: "invoice.paid",
  data: {
    object: {
      parent: {
        subscription_details: {
          subscription: "sub_test_xxxxxxxxxxxx",
        },
      },
      lines: {
        data: [{ period: { end: Math.floor(Date.now() / 1000) + 2_592_000 } }],
      },
    },
  },
  ...overrides,
});

export const makeInvoicePaymentFailedEvent = (
  overrides?: Record<string, unknown>,
) => ({
  id: "evt_test_payment_failed",
  type: "invoice.payment_failed",
  data: {
    object: {
      parent: {
        subscription_details: {
          subscription: "sub_test_xxxxxxxxxxxx",
        },
      },
    },
  },
  ...overrides,
});

export const makeSubscriptionUpdatedEvent = (
  overrides?: Record<string, unknown>,
) => ({
  id: "evt_test_sub_updated",
  type: "customer.subscription.updated",
  data: {
    object: {
      id: "sub_test_xxxxxxxxxxxx",
      status: "active",
      items: {
        data: [{ current_period_end: Math.floor(Date.now() / 1000) + 2_592_000 }],
      },
      cancel_at_period_end: false,
    },
  },
  ...overrides,
});

export const makeSubscriptionDeletedEvent = (
  overrides?: Record<string, unknown>,
) => ({
  id: "evt_test_sub_deleted",
  type: "customer.subscription.deleted",
  data: { object: { id: "sub_test_xxxxxxxxxxxx" } },
  ...overrides,
});
