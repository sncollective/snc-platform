import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import type Stripe from "stripe";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { AppError } from "@snc/shared";

import { db } from "../db/connection.js";
import {
  userSubscriptions,
  paymentEvents,
} from "../db/schema/subscription.schema.js";
import { verifyWebhookSignature } from "../services/stripe.js";
import { rootLogger } from "../logging/logger.js";
import { ERROR_400 } from "../lib/openapi-errors.js";

// ── Private Constants ──

const WEBHOOK_OK = z.object({ received: z.literal(true) });
const SECONDS_TO_MS = 1000;

// ── Private Handler Functions ──

/**
 * Handle `checkout.session.completed` — create a new user_subscriptions row.
 *
 * Extracts `userId` and `planId` from session metadata (set by
 * `createCheckoutSession` in sub-phase 7.3). The Stripe subscription ID
 * and customer ID come from the checkout session object itself.
 */
const handleCheckoutCompleted = async (
  data: Stripe.Checkout.Session,
): Promise<void> => {
  const userId = data.metadata?.userId;
  const planId = data.metadata?.planId;

  // subscription and customer may be expanded objects rather than bare IDs
  const sub = data.subscription;
  const stripeSubscriptionId = typeof sub === "string" ? sub : sub?.id;
  const cust = data.customer;
  const stripeCustomerId = typeof cust === "string" ? cust : (cust as Stripe.Customer | Stripe.DeletedCustomer | null)?.id;

  if (!userId || !planId || !stripeSubscriptionId || !stripeCustomerId) {
    rootLogger.error(
      { userId, planId, stripeSubscriptionId, stripeCustomerId },
      "checkout.session.completed missing required fields",
    );
    return;
  }

  await db.insert(userSubscriptions).values({
    id: `sub_${randomUUID()}`,
    userId,
    planId,
    stripeSubscriptionId,
    stripeCustomerId,
    status: "active",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  });
};

/**
 * Extract the subscription ID from a Stripe Invoice's parent field (Stripe v20+).
 * Returns the string ID, or undefined if not a subscription invoice.
 */
const getInvoiceSubscriptionId = (
  data: Stripe.Invoice,
): string | undefined => {
  const subDetails = data.parent?.subscription_details;
  if (!subDetails) return undefined;
  const sub = subDetails.subscription;
  return typeof sub === "string" ? sub : sub?.id;
};

/**
 * Handle `invoice.paid` — update subscription status to "active" and
 * refresh `currentPeriodEnd` from the invoice line item period.
 */
const handleInvoicePaid = async (
  data: Stripe.Invoice,
): Promise<void> => {
  const stripeSubscriptionId = getInvoiceSubscriptionId(data);
  if (!stripeSubscriptionId) return;

  // Extract period end from first line item
  const periodEndUnix = data.lines.data[0]?.period?.end;
  const currentPeriodEnd = periodEndUnix
    ? new Date(periodEndUnix * SECONDS_TO_MS)
    : null;

  await db
    .update(userSubscriptions)
    .set({
      status: "active",
      currentPeriodEnd,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId));
};

/**
 * Handle `invoice.payment_failed` — update subscription status to "past_due".
 */
const handlePaymentFailed = async (
  data: Stripe.Invoice,
): Promise<void> => {
  const stripeSubscriptionId = getInvoiceSubscriptionId(data);
  if (!stripeSubscriptionId) return;

  await db
    .update(userSubscriptions)
    .set({ status: "past_due", updatedAt: new Date() })
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId));
};

/**
 * Handle `customer.subscription.updated` — sync status, currentPeriodEnd,
 * and cancelAtPeriodEnd from the Stripe subscription object.
 *
 * In Stripe v20+, `current_period_end` lives on individual subscription
 * items rather than the top-level subscription object.
 */
const handleSubscriptionUpdated = async (
  data: Stripe.Subscription,
): Promise<void> => {
  const periodEnd = data.items.data[0]?.current_period_end;
  const currentPeriodEnd = periodEnd
    ? new Date(periodEnd * SECONDS_TO_MS)
    : null;

  await db
    .update(userSubscriptions)
    .set({
      status: data.status,
      currentPeriodEnd,
      cancelAtPeriodEnd: data.cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.stripeSubscriptionId, data.id));
};

/**
 * Handle `customer.subscription.deleted` — set status to "canceled".
 */
const handleSubscriptionDeleted = async (
  data: Stripe.Subscription,
): Promise<void> => {
  await db
    .update(userSubscriptions)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(eq(userSubscriptions.stripeSubscriptionId, data.id));
};

// ── Public API ──

export const webhookRoutes = new Hono();

webhookRoutes.post(
  "/stripe",
  describeRoute({
    description: "Process Stripe webhook events",
    tags: ["webhooks"],
    responses: {
      200: {
        description: "Event received and processed (or already processed)",
        content: {
          "application/json": { schema: resolver(WEBHOOK_OK) },
        },
      },
      400: ERROR_400,
    },
  }),
  async (c) => {
    // 1. Read raw body for signature verification
    const rawBody = await c.req.text();
    const signature = c.req.header("stripe-signature") ?? "";

    // 2. Verify webhook signature
    const verifyResult = verifyWebhookSignature(rawBody, signature);
    if (!verifyResult.ok) {
      throw verifyResult.error;
    }

    const event = verifyResult.value;

    // 3. Idempotency check: INSERT into payment_events
    //    If the event ID already exists, skip processing
    try {
      await db.insert(paymentEvents).values({
        id: event.id,
        type: event.type,
      });
    } catch (e) {
      // Unique constraint violation on PK means already processed (PostgreSQL code 23505)
      if (e && typeof e === "object" && "code" in e && e.code === "23505") {
        return c.json({ received: true as const });
      }
      // Re-throw unexpected DB errors
      throw e;
    }

    // 4. Dispatch to event-specific handler via discriminated switch
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        rootLogger.warn({ eventType: event.type, eventId: event.id }, "Unhandled Stripe webhook event type");
    }

    return c.json({ received: true as const });
  },
);
