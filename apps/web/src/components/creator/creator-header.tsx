import { useState } from "react";
import type React from "react";
import type { CreatorProfileResponse, SubscriptionPlan } from "@snc/shared";
import { Link } from "@tanstack/react-router";

import { formatPrice, formatIntervalShort } from "../../lib/format.js";
import { useSession } from "../../lib/auth.js";
import { useCheckout } from "../../hooks/use-checkout.js";
import { OptionalImage } from "../ui/optional-image.js";
import styles from "./creator-header.module.css";

// ── Public Types ──

export interface CreatorHeaderProps {
  readonly creator: CreatorProfileResponse;
  readonly plans?: readonly SubscriptionPlan[];
  readonly isSubscribed?: boolean;
}

// ── Public API ──

export function CreatorHeader({
  creator,
  plans,
  isSubscribed,
}: CreatorHeaderProps): React.ReactElement {
  const session = useSession();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const { checkoutLoading, handleCheckout } = useCheckout();

  const bannerSrc = creator.bannerUrl;
  const avatarSrc = creator.avatarUrl;

  const isAuthenticated = session.data !== null && session.data !== undefined;

  return (
    <header className={styles.header}>
      {/* Banner */}
      <div className={styles.bannerWrapper}>
        <OptionalImage
          src={bannerSrc}
          alt={`${creator.displayName} banner`}
          className={styles.banner}
          placeholderClassName={styles.bannerPlaceholder}
        />
      </div>

      {/* Profile Info */}
      <div className={styles.profileSection}>
        <div className={styles.avatarWrapper}>
          <OptionalImage
            src={avatarSrc}
            alt={`${creator.displayName} avatar`}
            className={styles.avatar}
            placeholderClassName={styles.avatarPlaceholder}
          />
        </div>

        <h1 className={styles.displayName}>{creator.displayName}</h1>

        {creator.bio && (
          <div className={styles.bio}>
            {creator.bio.split("\n\n").map((paragraph, index) => (
              <p key={index} className={styles.bioParagraph}>
                {paragraph}
              </p>
            ))}
          </div>
        )}

        {/* Subscribe Action */}
        {plans && plans.length > 0 && isSubscribed && (
          <button
            type="button"
            className={`${styles.subscribeButton} ${styles.subscribedButton}`}
            disabled
            aria-label="Already subscribed to this creator"
          >
            Subscribed
          </button>
        )}

        {plans && plans.length > 0 && !isSubscribed && !isAuthenticated && (
          <Link to="/login" className={styles.loginLink}>
            Subscribe
          </Link>
        )}

        {plans && plans.length > 0 && !isSubscribed && isAuthenticated && plans.length === 1 && (
          <button
            type="button"
            className={styles.subscribeButton}
            onClick={() => {
              void handleCheckout(plans[0]!.id);
            }}
            disabled={checkoutLoading}
          >
            {checkoutLoading
              ? "Subscribing..."
              : `Subscribe — ${formatPrice(plans[0]!.price)}/${formatIntervalShort(plans[0]!.interval)}`}
          </button>
        )}

        {plans && plans.length > 1 && !isSubscribed && isAuthenticated && (
          <div className={styles.tierSelector}>
            <select
              className={styles.planSelect}
              aria-label="Select subscription tier"
              value={selectedPlanId ?? plans[0]!.id}
              onChange={(e) => {
                setSelectedPlanId(e.target.value);
              }}
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {formatPrice(plan.price)}/{formatIntervalShort(plan.interval)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.subscribeButton}
              onClick={() => {
                void handleCheckout(selectedPlanId ?? plans[0]!.id);
              }}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? "Subscribing..." : "Subscribe"}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
