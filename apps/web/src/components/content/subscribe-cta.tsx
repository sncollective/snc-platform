import { useEffect, useState } from "react";
import type React from "react";
import type { ContentType, SubscriptionPlan } from "@snc/shared";

import { Link } from "@tanstack/react-router";

import { useSession } from "../../lib/auth.js";
import { formatPrice, formatIntervalShort } from "../../lib/format.js";
import { fetchPlans } from "../../lib/subscription.js";
import { useCheckout } from "../../hooks/use-checkout.js";
import styles from "./subscribe-cta.module.css";

// ── Public Types ──

export interface SubscribeCtaProps {
  readonly creatorId: string;
  readonly contentType: ContentType;
}

// ── Private Constants ──

const SUBSCRIBE_MESSAGES: Record<ContentType, string> = {
  video: "Subscribe to watch",
  audio: "Subscribe to listen",
  written: "Subscribe to read",
};

// ── Private Helpers ──

function cheapestPlan(plans: SubscriptionPlan[]): SubscriptionPlan | undefined {
  return plans.reduce<SubscriptionPlan | undefined>((min, plan) => {
    if (min === undefined || plan.price < min.price) {
      return plan;
    }
    return min;
  }, undefined);
}

// ── Public API ──

export function SubscribeCta({
  creatorId,
  contentType,
}: SubscribeCtaProps): React.ReactElement {
  const session = useSession();
  const isAuthenticated = session.data !== null;

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { checkoutLoading, handleCheckout } = useCheckout();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async (): Promise<void> => {
      try {
        const fetched = await fetchPlans({ creatorId });
        if (!cancelled) {
          setPlans(fetched);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load plans");
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  const bestPlan = cheapestPlan(plans);

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>{SUBSCRIBE_MESSAGES[contentType]}</h2>

      {loading && <p className={styles.loading}>Loading plans…</p>}

      {!loading && error !== null && (
        <p className={styles.error}>Unable to load plans.</p>
      )}

      {!loading && bestPlan !== undefined && (
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
              className={styles.subscribeButton}
              onClick={() => void handleCheckout(bestPlan.id)}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? "Subscribing…" : "Subscribe"}
            </button>
          ) : (
            <Link to="/login" className={styles.subscribeButton}>
              Subscribe
            </Link>
          )}

          <p className={styles.platformLink}>
            Or{" "}
            <Link to="/pricing">subscribe to the platform</Link> for full access
          </p>
        </>
      )}

      {!loading && bestPlan === undefined && (
        <p className={styles.platformLink}>
          <Link to="/pricing">Subscribe to the platform</Link> for full access
        </p>
      )}
    </div>
  );
}
