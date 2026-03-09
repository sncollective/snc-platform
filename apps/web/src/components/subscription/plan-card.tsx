import type React from "react";
import type { SubscriptionPlan } from "@snc/shared";

import { formatPrice, formatInterval } from "../../lib/format.js";
import buttonStyles from "../../styles/button.module.css";
import styles from "./plan-card.module.css";

// ── Public Types ──

export interface PlanCardProps {
  readonly plan: SubscriptionPlan;
  readonly onSubscribe: (planId: string) => void;
  readonly isSubscribed?: boolean;
  readonly isLoading?: boolean;
}

// ── Public API ──

export function PlanCard({
  plan,
  onSubscribe,
  isSubscribed,
  isLoading,
}: PlanCardProps): React.ReactElement {
  const isDisabled = isSubscribed === true || isLoading === true;

  return (
    <div className={styles.card}>
      <h3 className={styles.planName}>{plan.name}</h3>
      <div className={styles.priceRow}>
        <span className={styles.price}>{formatPrice(plan.price)}</span>
        <span className={styles.interval}>{formatInterval(plan.interval)}</span>
      </div>
      <button
        type="button"
        className={
          isSubscribed === true
            ? `${buttonStyles.primaryButton} ${styles.subscribedButton}`
            : buttonStyles.primaryButton
        }
        disabled={isDisabled}
        aria-label={isSubscribed === true ? "Already subscribed" : undefined}
        onClick={isDisabled ? undefined : () => onSubscribe(plan.id)}
      >
        {isSubscribed === true
          ? "Subscribed"
          : isLoading === true
            ? "Subscribing..."
            : "Subscribe"}
      </button>
    </div>
  );
}
