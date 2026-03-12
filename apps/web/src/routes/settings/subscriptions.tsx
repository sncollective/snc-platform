import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type React from "react";
import type { UserSubscriptionWithPlan } from "@snc/shared";

import { fetchAuthStateServer } from "../../lib/api-server.js";
import { isFeatureEnabled } from "../../lib/config.js";
import {
  fetchMySubscriptions,
  cancelSubscription,
} from "../../lib/subscription.js";
import { SubscriptionList } from "../../components/subscription/subscription-list.js";
import errorStyles from "../../styles/error-alert.module.css";
import listingStyles from "../../styles/listing-page.module.css";
import settingsStyles from "../../styles/settings-page.module.css";

export const Route = createFileRoute("/settings/subscriptions")({
  beforeLoad: async () => {
    if (!isFeatureEnabled("subscription")) throw redirect({ to: "/" });

    const { user } = await fetchAuthStateServer();
    if (!user) {
      throw redirect({ to: "/login" });
    }
  },
  component: SubscriptionManagementPage,
});

function SubscriptionManagementPage(): React.ReactElement {
  const [subscriptions, setSubscriptions] = useState<UserSubscriptionWithPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await fetchMySubscriptions();
        if (!cancelled) setSubscriptions(result);
      } catch {
        if (!cancelled) setError("Failed to load subscriptions");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCancel = async (subscriptionId: string): Promise<void> => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this subscription? " +
        "You will retain access until the end of your current billing period.",
    );
    if (!confirmed) return;

    setCancelingId(subscriptionId);
    setError(null);

    try {
      const updated = await cancelSubscription(subscriptionId);
      setSubscriptions((prev) =>
        prev.map((sub) => (sub.id === updated.id ? updated : sub)),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to cancel subscription",
      );
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <div className={settingsStyles.page}>
      <h1 className={listingStyles.heading}>My Subscriptions</h1>

      {error !== null && (
        <div className={errorStyles.error} role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className={listingStyles.status}>Loading subscriptions...</p>
      ) : (
        <SubscriptionList
          subscriptions={subscriptions}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
