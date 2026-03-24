import { useSession } from "../lib/auth.js";
import { hasPlatformSubscription } from "../lib/subscription.js";
import { useSubscriptions } from "./use-subscriptions.js";

// ── Public Types ──

export interface UsePlatformAuthResult {
  readonly isAuthenticated: boolean;
  readonly isSubscribed: boolean;
}

// ── Hook ──

/**
 * Derives platform-level auth state: whether the user is authenticated
 * and whether they hold an active platform subscription.
 *
 * Consolidates the repeated `useSession()` + `useSubscriptions()` +
 * `hasPlatformSubscription()` derivation used in landing components.
 */
export function usePlatformAuth(): UsePlatformAuthResult {
  const session = useSession();
  const subscriptions = useSubscriptions();

  const isAuthenticated =
    session.data !== null && session.data !== undefined;
  const isSubscribed = hasPlatformSubscription(subscriptions);

  return { isAuthenticated, isSubscribed };
}
