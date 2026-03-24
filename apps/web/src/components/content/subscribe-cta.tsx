import type React from "react";
import type { ContentType, SubscriptionPlan } from "@snc/shared";

import { Link } from "@tanstack/react-router";

import { formatPrice, formatIntervalShort } from "../../lib/format.js";
import { useCheckout } from "../../hooks/use-checkout.js";
import { usePlatformAuth } from "../../hooks/use-platform-auth.js";
import buttonStyles from "../../styles/button.module.css";
import styles from "./subscribe-cta.module.css";

// ── Public Types ──

export interface SubscribeCtaProps {
  readonly contentType: ContentType;
  readonly plans: readonly SubscriptionPlan[];
}

// ── Private Constants ──

const SUBSCRIBE_MESSAGES: Record<ContentType, string> = {
  video: "Subscribe to watch",
  audio: "Subscribe to listen",
  written: "Subscribe to read",
};

// ── Private Helpers ──

function cheapestPlan(plans: readonly SubscriptionPlan[]): SubscriptionPlan | undefined {
  return plans.reduce<SubscriptionPlan | undefined>((min, plan) => {
    if (min === undefined || plan.price < min.price) {
      return plan;
    }
    return min;
  }, undefined);
}

// ── Public API ──

export function SubscribeCta({
  contentType,
  plans,
}: SubscribeCtaProps): React.ReactElement {
  const { isAuthenticated } = usePlatformAuth();
  const { checkoutLoading, handleCheckout } = useCheckout();

  const bestPlan = cheapestPlan(plans);

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{SUBSCRIBE_MESSAGES[contentType]}</h2>

      {bestPlan !== undefined && (
        <>
          <div className={styles.planInfo}>
            <span className={styles.price}>{formatPrice(bestPlan.price)}</span>
            <span className={styles.interval}>
              / {formatIntervalShort(bestPlan.interval)}
            </span>
          </div>

          {isAuthenticated ? (
            <button
              type="button"
              className={buttonStyles.primaryButton}
              onClick={() => void handleCheckout(bestPlan.id)}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? "Subscribing…" : "Subscribe"}
            </button>
          ) : (
            <Link to="/login" className={buttonStyles.primaryButtonLink}>
              Subscribe
            </Link>
          )}

          <p className={styles.platformLink}>
            Or{" "}
            <Link to="/pricing">subscribe to the platform</Link> for full access
          </p>
        </>
      )}

      {bestPlan === undefined && (
        <p className={styles.platformLink}>
          <Link to="/pricing">Subscribe to the platform</Link> for full access
        </p>
      )}
    </div>
  );
}
