import { useEffect, useState } from "react";
import type { UserSubscriptionWithPlan } from "@snc/shared";

import { useSession } from "../lib/auth.js";
import { fetchMySubscriptions } from "../lib/subscription.js";

// ── Hook ──

/**
 * Fetches and returns the current user's subscriptions.
 * Returns an empty array when the user is not authenticated.
 * Silently ignores fetch errors — subscription status is supplementary.
 */
export function useSubscriptions(): readonly UserSubscriptionWithPlan[] {
  const session = useSession();
  const [subscriptions, setSubscriptions] = useState<UserSubscriptionWithPlan[]>([]);

  useEffect(() => {
    if (!session.data) {
      setSubscriptions([]);
      return;
    }
    const controller = new AbortController();
    const run = async (): Promise<void> => {
      try {
        const result = await fetchMySubscriptions(controller.signal);
        setSubscriptions(result);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        // Silently fail — subscription status is supplementary
      }
    };
    void run();
    return () => {
      controller.abort();
    };
  }, [session.data]);

  return subscriptions;
}
