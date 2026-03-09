import node_crypto from "node:crypto";

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
import { ERROR_400 } from "./openapi-errors.js";

// ── Private Constants ──

const WEBHOOK_OK = z.object({ received: z.literal(true) });

// ── Private Handler Functions ──

/**
 * Handle `checkout.session.completed` — create a new user_subscriptions row.
 *
 * Extracts `userId` and `planId` from session metadata (set by
 * `createCheckoutSession` in sub-phase 7.3). The Stripe subscription ID
 * and customer ID come from the checkout session object itself.
 */
const handleCheckoutCompleted = async (
  data: Record<string, unknown>,
): Promise<void> => {
  const metadata = data.metadata as
    | { userId?: string; planId?: string }
    | undefined;
  const userId = metadata?.userId;
  const planId = metadata?.planId;
  const stripeSubscriptionId = data.subscription as string | undefined;
  const stripeCustomerId = data.customer as string | undefined;

  if (!userId || !planId || !stripeSubscriptionId || !stripeCustomerId) {
    console.error(
      "checkout.session.completed missing required fields:",
      { userId, planId, stripeSubscriptionId, stripeCustomerId },
    );
    return;
  }

  await db.insert(userSubscriptions).values({
    id: `sub_${node_crypto.randomUUID()}`,
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
 * Handle `invoice.paid` — update subscription status to "active" and
 * refresh `currentPeriodEnd` from the invoice line item period.
 */
const handleInvoicePaid = async (
  data: Record<string, unknown>,
): Promise<void> => {
  const stripeSubscriptionId = data.subscription as string | undefined;
  if (!stripeSubscriptionId) return;

  // Extract period end from first line item
  const lines = data.lines as
    | { data: Array<{ period: { end: number } }> }
    | undefined;
  const periodEndUnix = lines?.data[0]?.period?.end;
  const currentPeriodEnd = periodEndUnix
    ? new Date(periodEndUnix * 1000)
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
  data: Record<string, unknown>,
): Promise<void> => {
  const stripeSubscriptionId = data.subscription as string | undefined;
  if (!stripeSubscriptionId) return;

  await db
    .update(userSubscriptions)
    .set({ status: "past_due", updatedAt: new Date() })
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId));
};

/**
 * Handle `customer.subscription.updated` — sync status, currentPeriodEnd,
 * and cancelAtPeriodEnd from the Stripe subscription object.
 */
const handleSubscriptionUpdated = async (
  data: Record<string, unknown>,
): Promise<void> => {
  const stripeSubscriptionId = data.id as string | undefined;
  if (!stripeSubscriptionId) return;

  const status = data.status as string;
  const cancelAtPeriodEnd = data.cancel_at_period_end as boolean;
  const periodEndUnix = data.current_period_end as number | undefined;
  const currentPeriodEnd = periodEndUnix
    ? new Date(periodEndUnix * 1000)
    : null;

  await db
    .update(userSubscriptions)
    .set({
      status,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId));
};

/**
 * Handle `customer.subscription.deleted` — set status to "canceled".
 */
const handleSubscriptionDeleted = async (
  data: Record<string, unknown>,
): Promise<void> => {
  const stripeSubscriptionId = data.id as string | undefined;
  if (!stripeSubscriptionId) return;

  await db
    .update(userSubscriptions)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId));
};

// ── Event Dispatch Map ──

/**
 * Maps Stripe event types to their handler functions.
 * Unknown event types are silently ignored (return 200).
 */
const EVENT_HANDLERS: Record<
  string,
  ((data: Record<string, unknown>) => Promise<void>) | undefined
> = {
  "checkout.session.completed": handleCheckoutCompleted,
  "invoice.paid": handleInvoicePaid,
  "invoice.payment_failed": handlePaymentFailed,
  "customer.subscription.updated": handleSubscriptionUpdated,
  "customer.subscription.deleted": handleSubscriptionDeleted,
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

    const event: Pick<Stripe.Event, "id" | "type" | "data"> =
      verifyResult.value;

    // 3. Idempotency check: INSERT into payment_events
    //    If the event ID already exists, skip processing
    try {
      await db.insert(paymentEvents).values({
        id: event.id,
        type: event.type,
      });
    } catch (e) {
      // Unique constraint violation on PK means already processed
      if (
        e instanceof Error &&
        e.message.includes("duplicate key")
      ) {
        return c.json({ received: true as const });
      }
      // Re-throw unexpected DB errors
      throw e;
    }

    // 4. Dispatch to event-specific handler
    const handler = EVENT_HANDLERS[event.type];
    if (handler) {
      // Stripe.Event.Data.Object is a union of 80+ specific types;
      // handlers use Record<string, unknown> to extract fields generically.
      await handler(event.data.object as unknown as Record<string, unknown>);
    }
    // Unknown event types are silently acknowledged

    return c.json({ received: true as const });
  },
);
