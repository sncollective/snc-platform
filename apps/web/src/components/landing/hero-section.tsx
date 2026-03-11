import { Link, useNavigate } from "@tanstack/react-router";
import type React from "react";
import type { SubscriptionPlan } from "@snc/shared";

import { usePlatformAuth } from "../../hooks/use-platform-auth.js";
import { useCheckout } from "../../hooks/use-checkout.js";
import buttonStyles from "../../styles/button.module.css";
import styles from "./hero-section.module.css";

interface HeroSectionProps {
  readonly plans: SubscriptionPlan[];
}

export function HeroSection({ plans }: HeroSectionProps): React.ReactElement {
  const navigate = useNavigate();
  const { isAuthenticated, isSubscribed } = usePlatformAuth();
  const platformPlanId: string | undefined = plans[0]?.id;

  const { checkoutLoading, handleCheckout } = useCheckout({
    onError: () => void navigate({ to: "/pricing" }),
  });

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

    await handleCheckout(platformPlanId);
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
            <Link to="/feed" className={`${buttonStyles.primaryButton} ${styles.primaryCta}`}>
              Explore Content
            </Link>
          ) : (
            <button
              type="button"
              className={`${buttonStyles.primaryButton} ${styles.primaryCta}`}
              disabled={checkoutLoading}
              onClick={() => void handlePrimaryCta()}
            >
              {checkoutLoading ? "Loading..." : "Subscribe"}
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
