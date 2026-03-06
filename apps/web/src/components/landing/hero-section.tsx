import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";
import type { SubscriptionPlan } from "@snc/shared";

import { useSession } from "../../lib/auth.js";
import { createCheckout, hasPlatformSubscription } from "../../lib/subscription.js";
import { useSubscriptions } from "../../hooks/use-subscriptions.js";
import styles from "./hero-section.module.css";

interface HeroSectionProps {
  plans: SubscriptionPlan[];
}

export function HeroSection({ plans }: HeroSectionProps): React.ReactElement {
  const session = useSession();
  const navigate = useNavigate();
  const subscriptions = useSubscriptions();
  const [isLoading, setIsLoading] = useState(false);

  const isAuthenticated: boolean = session.data !== null && session.data !== undefined;
  const isSubscribed: boolean = hasPlatformSubscription(subscriptions);
  const platformPlanId: string | undefined = plans[0]?.id;

  async function handlePrimaryCta(): Promise<void> {
    if (isSubscribed) {
      void navigate({ to: "/feed" });
      return;
    }

    if (!isAuthenticated) {
      void navigate({ to: "/login" });
      return;
    }

    // Authenticated but not subscribed — start checkout
    if (platformPlanId === undefined) {
      // No plans loaded — fall back to pricing page
      void navigate({ to: "/pricing" });
      return;
    }

    setIsLoading(true);
    try {
      const checkoutUrl = await createCheckout(platformPlanId);
      window.location.href = checkoutUrl;
    } catch {
      // On checkout failure, redirect to pricing page as fallback
      void navigate({ to: "/pricing" });
      setIsLoading(false);
    }
  }

  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        <h1 className={styles.heading}>Signal to Noise Collective</h1>
        <p className={styles.subheading}>
          <strong><em>We cut through the noise - and we boost the signal.</em></strong>
        </p>
        <p className={styles.subheading}>
          A cooperatively-owned media organization. A federation of services
          and platforms for creators, owned and governed by the people who run them.
        </p>
        <div className={styles.actions}>
          {isSubscribed ? (
            <Link to="/feed" className={styles.primaryCta}>
              Explore Content
            </Link>
          ) : (
            <button
              type="button"
              className={styles.primaryCta}
              disabled={isLoading}
              onClick={() => void handlePrimaryCta()}
            >
              {isLoading ? "Loading..." : "Subscribe"}
            </button>
          )}
          <Link to="/feed" className={styles.secondaryCta}>
            Browse Free Content
          </Link>
        </div>
      </div>
    </section>
  );
}
