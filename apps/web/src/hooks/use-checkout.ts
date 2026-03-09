import { useState } from "react";

import { createCheckout } from "../lib/subscription.js";
import { navigateExternal } from "../lib/url.js";

// ── Public Types ──

export interface UseCheckoutResult {
  readonly checkoutLoading: boolean;
  readonly handleCheckout: (planId: string) => Promise<void>;
}

// ── Hook ──

/**
 * Encapsulates the checkout flow: loading state + createCheckout + redirect.
 *
 * On success, navigates to the Stripe Checkout URL.
 * On failure, resets loading state and calls the optional `onError` callback.
 */
export function useCheckout(options?: {
  onError?: () => void;
}): UseCheckoutResult {
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleCheckout = async (planId: string): Promise<void> => {
    setCheckoutLoading(true);
    try {
      const url = await createCheckout(planId);
      navigateExternal(url);
    } catch {
      setCheckoutLoading(false);
      options?.onError?.();
    }
  };

  return { checkoutLoading, handleCheckout };
}
