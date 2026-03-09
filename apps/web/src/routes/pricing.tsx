import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";
import type { SubscriptionPlan } from "@snc/shared";

import { PlanCard } from "../components/subscription/plan-card.js";
import { fetchApiServer } from "../lib/api-server.js";
import { usePlatformAuth } from "../hooks/use-platform-auth.js";
import { useCheckout } from "../hooks/use-checkout.js";
import errorStyles from "../styles/error-alert.module.css";
import pageHeadingStyles from "../styles/page-heading.module.css";
import styles from "./pricing.module.css";

export const Route = createFileRoute("/pricing")({
  loader: async (): Promise<SubscriptionPlan[]> => {
    try {
      const data = (await fetchApiServer({
        data: "/api/subscriptions/plans?type=platform",
      })) as { plans: SubscriptionPlan[] };
      return data.plans;
    } catch {
      return [];
    }
  },
  component: PricingPage,
});

function PricingPage(): React.ReactElement {
  const navigate = useNavigate();
  const plans = Route.useLoaderData();
  const { isAuthenticated, isSubscribed: isSubscribedToPlatform } = usePlatformAuth();
  const [error, setError] = useState<string | null>(null);

  const { checkoutLoading, handleCheckout } = useCheckout({
    onError: (message) => setError(message),
  });

  async function handleSubscribe(planId: string): Promise<void> {
    if (!isAuthenticated) {
      void navigate({ to: "/login" });
      return;
    }

    setError(null);
    await handleCheckout(planId);
  }

  return (
    <div className={styles.pricingPage}>
      <h1 className={pageHeadingStyles.heading}>Platform Subscription</h1>
      <p className={styles.subheading}>
        Get access to all content from every creator on S/NC.
      </p>

      {error !== null && (
        <div className={errorStyles.error} role="alert">
          {error}
        </div>
      )}

      {isSubscribedToPlatform ? (
        <div className={styles.subscribedBanner}>
          <p className={styles.subscribedText}>You're subscribed!</p>
          <Link to={"/settings/subscriptions" as never} className={styles.manageLink}>
            Manage subscriptions
          </Link>
        </div>
      ) : null}

      {plans.length === 0 ? (
        <p className={styles.status}>No plans available.</p>
      ) : (
        <div className={styles.planGrid}>
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onSubscribe={(planId) => void handleSubscribe(planId)}
              isSubscribed={isSubscribedToPlatform}
              isLoading={checkoutLoading}
            />
          ))}
        </div>
      )}

      <p className={styles.creatorNote}>
        Want to support a specific creator? Visit their page to subscribe.
      </p>
    </div>
  );
}
