import type {
  SubscriptionPlan,
  UserSubscriptionWithPlan,
} from "@snc/shared";

import { apiGet, apiMutate } from "./fetch-utils.js";

/**
 * Fetch available subscription plans.
 * Optional params filter by type or creatorId.
 */
export async function fetchPlans(params?: {
  type?: string;
  creatorId?: string;
}): Promise<SubscriptionPlan[]> {
  const data = await apiGet<{ plans: SubscriptionPlan[] }>(
    "/api/subscriptions/plans",
    params,
  );
  return data.plans;
}

/**
 * Create a Stripe Checkout session for the given plan.
 * Returns the checkout URL.
 */
export async function createCheckout(planId: string): Promise<string> {
  const data = await apiMutate<{ checkoutUrl: string }>(
    "/api/subscriptions/checkout",
    { body: { planId } },
  );
  return data.checkoutUrl;
}

/**
 * Fetch the current user's subscriptions with nested plan data.
 */
export async function fetchMySubscriptions(
  signal?: AbortSignal,
): Promise<UserSubscriptionWithPlan[]> {
  const data = await apiGet<{ subscriptions: UserSubscriptionWithPlan[] }>(
    "/api/subscriptions/mine",
    undefined,
    signal,
  );
  return data.subscriptions;
}

/**
 * Returns true if the user has an active platform subscription.
 */
export function hasPlatformSubscription(
  subscriptions: readonly UserSubscriptionWithPlan[],
): boolean {
  return subscriptions.some(
    (sub) => sub.plan.type === "platform" && sub.status === "active",
  );
}

/**
 * Cancel a subscription by its ID (our user_subscriptions.id).
 */
export async function cancelSubscription(
  subscriptionId: string,
): Promise<void> {
  await apiMutate<void>("/api/subscriptions/cancel", {
    body: { subscriptionId },
  });
}
