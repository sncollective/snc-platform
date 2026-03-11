import Stripe from "stripe";

import { AppError } from "@snc/shared";

/**
 * Factory that creates a typed error-wrapping function for an external service.
 * Usage:
 *   const wrapShopifyError = wrapExternalError("SHOPIFY_ERROR");
 *   return err(wrapShopifyError(e));
 */
export const wrapExternalError =
  (code: string) =>
  (e: unknown): AppError =>
    new AppError(code, e instanceof Error ? e.message : String(e), 502);

/**
 * Stripe-specific error wrapper with type-aware HTTP status codes.
 *
 * Maps Stripe SDK error subclasses to appropriate HTTP statuses instead of
 * blanket 502 for all failures.
 */
export const wrapStripeErrorGranular = (e: unknown): AppError => {
  if (e instanceof Stripe.errors.StripeCardError)
    return new AppError("STRIPE_CARD_ERROR", e.message, 400);
  if (e instanceof Stripe.errors.StripeInvalidRequestError)
    return new AppError("STRIPE_INVALID_REQUEST", e.message, 400);
  if (e instanceof Stripe.errors.StripeRateLimitError)
    return new AppError("STRIPE_RATE_LIMIT", e.message, 429);
  if (e instanceof Stripe.errors.StripeAuthenticationError)
    return new AppError("STRIPE_AUTH_ERROR", e.message, 500);
  if (e instanceof Stripe.errors.StripeConnectionError)
    return new AppError("STRIPE_CONNECTION_ERROR", e.message, 502);
  if (e instanceof Stripe.errors.StripeAPIError)
    return new AppError("STRIPE_API_ERROR", e.message, 502);
  return new AppError(
    "STRIPE_ERROR",
    e instanceof Error ? e.message : String(e),
    502,
  );
};
