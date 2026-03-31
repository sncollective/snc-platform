import Stripe from "stripe";

import { AppError } from "@snc/shared";

import { rootLogger } from "../logging/logger.js";

/**
 * Factory that creates a typed error-wrapping function for an external service.
 * Usage:
 *   const wrapShopifyError = wrapExternalError("SHOPIFY_ERROR");
 *   return err(wrapShopifyError(e));
 */
export const wrapExternalError =
  (code: string) =>
  (e: unknown): AppError => {
    rootLogger.error({ error: e instanceof Error ? e.message : String(e) }, `External service error [${code}]`);
    return new AppError(code, "External service error", 502);
  };

/**
 * Stripe-specific error wrapper with type-aware HTTP status codes.
 *
 * Maps Stripe SDK error subclasses to appropriate HTTP statuses instead of
 * blanket 502 for all failures.
 */
export const wrapStripeErrorGranular = (e: unknown): AppError => {
  if (e instanceof Stripe.errors.StripeCardError)
    return new AppError("STRIPE_CARD_ERROR", e.message, 400);
  if (e instanceof Stripe.errors.StripeInvalidRequestError) {
    rootLogger.error({ err: e }, "Stripe invalid request error");
    return new AppError("STRIPE_INVALID_REQUEST", "Invalid payment request", 400);
  }
  if (e instanceof Stripe.errors.StripeRateLimitError) {
    rootLogger.error({ error: e.message }, "Stripe rate limit exceeded");
    return new AppError("STRIPE_RATE_LIMIT", "Payment service temporarily unavailable", 429);
  }
  if (e instanceof Stripe.errors.StripeAuthenticationError) {
    rootLogger.error({ error: e.message }, "Stripe authentication failed");
    return new AppError("STRIPE_AUTH_ERROR", "Payment service error", 500);
  }
  if (e instanceof Stripe.errors.StripeConnectionError) {
    rootLogger.error({ error: e.message }, "Stripe connection failed");
    return new AppError("STRIPE_CONNECTION_ERROR", "Payment service unavailable", 502);
  }
  if (e instanceof Stripe.errors.StripeAPIError) {
    rootLogger.error({ error: e.message }, "Stripe API error");
    return new AppError("STRIPE_API_ERROR", "Payment service error", 502);
  }
  rootLogger.error({ error: e instanceof Error ? e.message : String(e) }, "Stripe unknown error");
  return new AppError(
    "STRIPE_ERROR",
    "Payment service error",
    502,
  );
};
