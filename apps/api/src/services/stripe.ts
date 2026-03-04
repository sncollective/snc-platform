import Stripe from "stripe";

import { AppError, ok, err, type Result } from "@snc/shared";

import { config } from "../config.js";
import { wrapExternalError } from "./external-error.js";

// ── Public Types ──

export type CreateCheckoutSessionParams = {
  customerId: string;
  planStripePriceId: string;
  userId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
};

// ── Module-Level Configuration ──

const STRIPE_KEY: string | null = config.STRIPE_SECRET_KEY ?? null;

// ── Private Helpers ──

const wrapStripeError = wrapExternalError("STRIPE_ERROR");

let stripeInstance: Stripe | null = null;

const getStripe = (): Stripe => {
  if (stripeInstance === null) {
    stripeInstance = new Stripe(STRIPE_KEY!);
  }
  return stripeInstance;
};

const ensureConfigured = (): Result<void, AppError> => {
  if (STRIPE_KEY === null) {
    return err(
      new AppError(
        "BILLING_NOT_CONFIGURED",
        "Stripe integration is not configured",
        503,
      ),
    );
  }
  return ok(undefined);
};

// ── Public API ──

/**
 * Search for an existing Stripe customer by `sncUserId` metadata, or create
 * a new customer if none exists.
 *
 * @returns The Stripe customer ID (e.g., `"cus_xxx"`)
 */
export const getOrCreateCustomer = async (
  userId: string,
  email: string,
): Promise<Result<string, AppError>> => {
  const configured = ensureConfigured();
  if (!configured.ok) return configured as Result<string, AppError>;

  try {
    const stripe = getStripe();
    const search = await stripe.customers.search({
      query: `metadata["sncUserId"]:"${userId}"`,
    });

    const [first] = search.data;
    if (first !== undefined) {
      return ok(first.id);
    }

    const customer = await stripe.customers.create({
      email,
      metadata: { sncUserId: userId },
    });

    return ok(customer.id);
  } catch (e) {
    return err(wrapStripeError(e));
  }
};

/**
 * Create a Stripe Checkout session in subscription mode.
 *
 * @returns The checkout session URL for browser redirect
 */
export const createCheckoutSession = async (
  params: CreateCheckoutSessionParams,
): Promise<Result<string, AppError>> => {
  const configured = ensureConfigured();
  if (!configured.ok) return configured as Result<string, AppError>;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      customer: params.customerId,
      mode: "subscription",
      line_items: [{ price: params.planStripePriceId, quantity: 1 }],
      metadata: { userId: params.userId, planId: params.planId },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    if (session.url === null) {
      return err(
        new AppError("STRIPE_ERROR", "Checkout session URL was null", 502),
      );
    }

    return ok(session.url);
  } catch (e) {
    return err(wrapStripeError(e));
  }
};

/**
 * Mark a Stripe subscription for cancellation at the end of the current
 * billing period.
 */
export const cancelSubscriptionAtPeriodEnd = async (
  stripeSubscriptionId: string,
): Promise<Result<void, AppError>> => {
  const configured = ensureConfigured();
  if (!configured.ok) return configured;

  try {
    const stripe = getStripe();
    await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    return ok(undefined);
  } catch (e) {
    return err(wrapStripeError(e));
  }
};

/**
 * Verify a Stripe webhook event signature and parse the raw body.
 *
 * NOTE: This function is synchronous — `constructEvent` does not return
 * a Promise.
 */
export const verifyWebhookSignature = (
  rawBody: string,
  signature: string,
): Result<Stripe.Event, AppError> => {
  const configured = ensureConfigured();
  if (!configured.ok) return configured as Result<Stripe.Event, AppError>;

  if (!config.STRIPE_WEBHOOK_SECRET) {
    return err(
      new AppError("BILLING_NOT_CONFIGURED", "Webhook secret not configured", 503),
    );
  }

  try {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.STRIPE_WEBHOOK_SECRET,
    );

    return ok(event);
  } catch (e) {
    return err(
      new AppError(
        "WEBHOOK_SIGNATURE_ERROR",
        e instanceof Error ? e.message : String(e),
        400,
      ),
    );
  }
};
