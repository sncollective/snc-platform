import Stripe from "stripe";

import { AppError, ok, err, type Result } from "@snc/shared";

import { config } from "../config.js";

// ── Module-Level Configuration ──

const STRIPE_KEY: string | null = config.STRIPE_SECRET_KEY ?? null;

// ── Singleton ──

let stripeInstance: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (stripeInstance === null) {
    stripeInstance = new Stripe(STRIPE_KEY!);
  }
  return stripeInstance;
};

// ── Guard ──

export const ensureConfigured = (): Result<void, AppError> => {
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
