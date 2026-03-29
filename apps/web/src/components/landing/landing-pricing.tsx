import type React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { SubscriptionPlan } from "@snc/shared";

import { usePlatformAuth } from "../../hooks/use-platform-auth.js";
import { useCheckout } from "../../hooks/use-checkout.js";
import { PlanCard } from "../subscription/plan-card.js";
import { clsx } from "clsx/lite";

import sectionStyles from "../../styles/landing-section.module.css";
import styles from "./landing-pricing.module.css";

// ── Public API ──

interface LandingPricingProps {
  readonly plans: readonly SubscriptionPlan[];
}

/** Landing pricing section displaying subscription plans with a checkout CTA or subscribed state. */
export function LandingPricing({ plans }: LandingPricingProps): React.ReactElement {
  const navigate = useNavigate();
  const { isAuthenticated, isSubscribed: isSubscribedToPlatform } = usePlatformAuth();

  const { checkoutLoading, handleCheckout } = useCheckout();

  async function handleSubscribe(planId: string): Promise<void> {
    if (!isAuthenticated) {
      void navigate({ to: "/login" });
      return;
    }

    await handleCheckout(planId);
  }

  return (
    <section className={clsx(sectionStyles.section, styles.sectionElevated)}>
      <h2 className={clsx(sectionStyles.heading, styles.headingCenter)}>Get Access to Everything</h2>
      <p className={styles.subheading}>
        Subscribe to the platform and access all content from every creator.
      </p>
      {plans.length === 0 ? (
        <p className={clsx(sectionStyles.loading, styles.loading)}>Plans coming soon!</p>
      ) : isSubscribedToPlatform ? (
        <div className={styles.subscribedBanner}>
          <p className={styles.subscribedText}>You're subscribed!</p>
          <Link to="/feed" className={styles.subscribedLink}>
            Explore content
          </Link>
        </div>
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
      <Link to="/pricing" className={styles.learnMore}>
        Learn more about pricing →
      </Link>
    </section>
  );
}
