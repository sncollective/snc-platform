import type React from "react";
import type { UserSubscriptionWithPlan } from "@snc/shared";

import { Link } from "@tanstack/react-router";

import { formatDate, formatPrice } from "../../lib/format.js";

import listItemStyles from "../../styles/list-items.module.css";
import styles from "./subscription-list.module.css";

// ── Public Types ──

export interface SubscriptionListProps {
  readonly subscriptions: readonly UserSubscriptionWithPlan[];
  readonly onCancel: (subscriptionId: string) => void;
}

// ── Private Helpers ──

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  canceled: "Canceled",
  past_due: "Past Due",
};

function getStatusLabel(
  status: string,
  cancelAtPeriodEnd: boolean,
): string {
  if (status === "active" && cancelAtPeriodEnd) return "Canceling";
  return STATUS_LABELS[status] ?? "Incomplete";
}

function getStatusClass(
  status: string,
  cancelAtPeriodEnd: boolean,
): string | undefined {
  if (status === "active" && !cancelAtPeriodEnd) return styles.statusActive;
  if (status === "active" && cancelAtPeriodEnd) return styles.statusCanceling;
  return styles.statusInactive;
}

// ── Public API ──

export function SubscriptionList({
  subscriptions,
  onCancel,
}: SubscriptionListProps): React.ReactElement {
  if (subscriptions.length === 0) {
    return (
      <div className={listItemStyles.empty}>
        <p className={`${listItemStyles.emptyText} ${styles.emptyText}`}>No active subscriptions</p>
        <Link to="/pricing" className={styles.browseLink}>
          Browse plans
        </Link>
      </div>
    );
  }

  return (
    <div className={listItemStyles.list}>
      {subscriptions.map((sub) => {
        const isCanceling = sub.cancelAtPeriodEnd && sub.status === "active";
        const isActive = sub.status === "active";
        const isCancelDisabled = sub.cancelAtPeriodEnd || sub.status !== "active";
        const planTypeLabel =
          sub.plan.type === "platform" ? "Platform" : "Creator";

        return (
          <div key={sub.id} className={listItemStyles.item}>
            <div className={listItemStyles.itemHeader}>
              <h3 className={styles.planName}>{sub.plan.name}</h3>
              <span
                className={`${listItemStyles.statusBadge} ${getStatusClass(sub.status, sub.cancelAtPeriodEnd)}`}
              >
                {getStatusLabel(sub.status, sub.cancelAtPeriodEnd)}
              </span>
            </div>
            <div className={styles.planType}>{planTypeLabel}</div>
            <div className={styles.priceRow}>
              {formatPrice(sub.plan.price)} / {sub.plan.interval}
            </div>
            {isCanceling && sub.currentPeriodEnd !== null && (
              <div className={styles.cancelingMessage}>
                Canceling — access until {formatDate(sub.currentPeriodEnd)}
              </div>
            )}
            {isActive && !isCanceling && sub.currentPeriodEnd !== null && (
              <div className={styles.billingDate}>
                Next billing: {formatDate(sub.currentPeriodEnd)}
              </div>
            )}
            <button
              type="button"
              className={styles.cancelButton}
              disabled={isCancelDisabled}
              onClick={() => onCancel(sub.id)}
            >
              Cancel Subscription
            </button>
          </div>
        );
      })}
    </div>
  );
}
