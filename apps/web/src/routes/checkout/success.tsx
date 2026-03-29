import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import type { UserSubscriptionWithPlan } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { fetchAuthStateServer } from "../../lib/api-server.js";
import { isFeatureEnabled } from "../../lib/config.js";
import { buildLoginRedirect } from "../../lib/return-to.js";
import { fetchMySubscriptions } from "../../lib/subscription.js";
import buttonStyles from "../../styles/button.module.css";
import pageHeadingStyles from "../../styles/page-heading.module.css";
import styles from "./success.module.css";

const MAX_POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 2000;

export const Route = createFileRoute("/checkout/success")({
  beforeLoad: async ({ location }) => {
    if (!isFeatureEnabled("subscription")) throw redirect({ to: "/" });

    const { user } = await fetchAuthStateServer();
    if (!user) {
      throw redirect(buildLoginRedirect(location.pathname));
    }
  },
  errorComponent: RouteErrorBoundary,
  head: () => ({ meta: [{ title: "Checkout — S/NC" }] }),
  component: CheckoutSuccessPage,
});

function CheckoutSuccessPage(): React.ReactElement {
  const [subscriptions, setSubscriptions] = useState<UserSubscriptionWithPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pollCountRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function poll(): Promise<void> {
      try {
        const subs = await fetchMySubscriptions();
        if (cancelled) return;
        setSubscriptions(subs);

        const hasActive = subs.some((s) => s.status === "active");
        if (hasActive || pollCountRef.current >= MAX_POLL_ATTEMPTS) {
          setIsLoading(false);
          return;
        }

        pollCountRef.current += 1;
        timeoutId = setTimeout(() => {
          if (!cancelled) void poll();
        }, POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) setIsLoading(false);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);

  const activeSubscription = subscriptions.find((s) => s.status === "active") ?? null;
  const isProcessing = isLoading;

  return (
    <div className={styles.successPage}>
      {isProcessing ? (
        <>
          <h1 className={pageHeadingStyles.heading}>Processing your payment...</h1>
          <p className={styles.message}>
            This may take a moment. Please wait while we confirm your subscription.
          </p>
          <div className={styles.spinner} aria-label="Loading" />
        </>
      ) : activeSubscription !== null ? (
        <>
          <h1 className={pageHeadingStyles.heading}>Welcome!</h1>
          <p className={styles.message}>
            You now have access to{" "}
            <strong>{activeSubscription.plan.name}</strong>.
          </p>
          <div className={styles.links}>
            <Link to="/feed" className={buttonStyles.primaryButtonLink}>
              Browse Feed
            </Link>
            <Link to="/creators" className={styles.secondaryLink}>
              Explore Creators
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className={pageHeadingStyles.heading}>Almost there!</h1>
          <p className={styles.message}>
            Your payment is being processed. It may take a minute for your
            subscription to activate. Please check back shortly.
          </p>
          <div className={styles.links}>
            <Link to="/feed" className={buttonStyles.primaryButtonLink}>
              Go to Feed
            </Link>
            <Link to="/pricing" className={styles.secondaryLink}>
              Back to Pricing
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
