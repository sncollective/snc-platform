import { describe, it, expect } from "vitest";
import Stripe from "stripe";

import { AppError } from "@snc/shared";

import {
  wrapExternalError,
  wrapStripeErrorGranular,
} from "../../src/services/external-error.js";

describe("wrapExternalError", () => {
  const wrapShopifyError = wrapExternalError("SHOPIFY_ERROR");

  it("wraps Error instances with code and 502 status", () => {
    const result = wrapShopifyError(new Error("GraphQL failed"));

    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe("SHOPIFY_ERROR");
    expect(result.message).toBe("External service error");
    expect(result.statusCode).toBe(502);
  });

  it("wraps non-Error values by stringifying", () => {
    const result = wrapShopifyError("raw string error");

    expect(result.code).toBe("SHOPIFY_ERROR");
    expect(result.message).toBe("External service error");
    expect(result.statusCode).toBe(502);
  });
});

describe("wrapStripeErrorGranular", () => {
  it("maps StripeCardError to 400", () => {
    const err = new Stripe.errors.StripeCardError({
      type: "card_error",
      message: "Your card was declined",
    });
    const result = wrapStripeErrorGranular(err);

    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe("STRIPE_CARD_ERROR");
    expect(result.message).toBe("Your card was declined");
    expect(result.statusCode).toBe(400);
  });

  it("maps StripeInvalidRequestError to 400", () => {
    const err = new Stripe.errors.StripeInvalidRequestError({
      type: "invalid_request_error",
      message: "Invalid price ID",
    });
    const result = wrapStripeErrorGranular(err);

    expect(result.code).toBe("STRIPE_INVALID_REQUEST");
    expect(result.statusCode).toBe(400);
  });

  it("maps StripeRateLimitError to 429 with generic message", () => {
    const err = new Stripe.errors.StripeRateLimitError({
      type: "rate_limit_error",
      message: "Too many requests",
    });
    const result = wrapStripeErrorGranular(err);

    expect(result.code).toBe("STRIPE_RATE_LIMIT");
    expect(result.message).toBe("Payment service temporarily unavailable");
    expect(result.statusCode).toBe(429);
  });

  it("maps StripeAuthenticationError to 500 with generic message", () => {
    const err = new Stripe.errors.StripeAuthenticationError({
      type: "authentication_error",
      message: "Invalid API key provided: sk_test_****XXXX",
    });
    const result = wrapStripeErrorGranular(err);

    expect(result.code).toBe("STRIPE_AUTH_ERROR");
    expect(result.message).toBe("Payment service error");
    expect(result.statusCode).toBe(500);
  });

  it("maps StripeConnectionError to 502 with generic message", () => {
    const err = new Stripe.errors.StripeConnectionError({
      type: "api_error",
      message: "Connection refused",
    });
    const result = wrapStripeErrorGranular(err);

    expect(result.code).toBe("STRIPE_CONNECTION_ERROR");
    expect(result.message).toBe("Payment service unavailable");
    expect(result.statusCode).toBe(502);
  });

  it("maps StripeAPIError to 502 with generic message", () => {
    const err = new Stripe.errors.StripeAPIError({
      type: "api_error",
      message: "Internal Stripe error",
    });
    const result = wrapStripeErrorGranular(err);

    expect(result.code).toBe("STRIPE_API_ERROR");
    expect(result.message).toBe("Payment service error");
    expect(result.statusCode).toBe(502);
  });

  it("maps unknown Error to generic STRIPE_ERROR with 502", () => {
    const err = new Error("Unknown failure");
    const result = wrapStripeErrorGranular(err);

    expect(result.code).toBe("STRIPE_ERROR");
    expect(result.message).toBe("Payment service error");
    expect(result.statusCode).toBe(502);
  });

  it("maps non-Error values to generic STRIPE_ERROR with 502", () => {
    const result = wrapStripeErrorGranular("string error");

    expect(result.code).toBe("STRIPE_ERROR");
    expect(result.message).toBe("Payment service error");
    expect(result.statusCode).toBe(502);
  });
});
