import { useState } from "react";
import type React from "react";
import type { CreatorProfileResponse, SubscriptionPlan } from "@snc/shared";
import { FEDERATION_DOMAIN } from "@snc/shared";
import { Link } from "@tanstack/react-router";

import { formatPrice, formatIntervalShort } from "../../lib/format.js";
import { useSession } from "../../lib/auth.js";
import { useCheckout } from "../../hooks/use-checkout.js";
import { isFeatureEnabled } from "../../lib/config.js";
import { FediverseAddress } from "../federation/fediverse-address.js";
import { FollowFediverseDialog } from "../federation/follow-fediverse-dialog.js";
import { OptionalImage } from "../ui/optional-image.js";
import buttonStyles from "../../styles/button.module.css";
import styles from "./creator-header.module.css";

// ── Public Types ──

export interface CreatorHeaderProps {
  readonly creator: CreatorProfileResponse;
  readonly plans?: readonly SubscriptionPlan[];
  readonly isSubscribed?: boolean;
  readonly canManage?: boolean;
}

// ── Public API ──

export function CreatorHeader({
  creator,
  plans,
  isSubscribed,
  canManage,
}: CreatorHeaderProps): React.ReactElement {
  const session = useSession();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [followDialogOpen, setFollowDialogOpen] = useState(false);
  const { checkoutLoading, handleCheckout } = useCheckout();

  const showFediverseUI =
    isFeatureEnabled("federation") && creator.handle !== null && creator.handle !== undefined;

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
          className={styles.banner!}
          placeholderClassName={styles.bannerPlaceholder!}
          width={800}
          height={200}
        />
      </div>

      {/* Profile Info */}
      <div className={styles.profileSection}>
        <div className={styles.avatarWrapper}>
          <OptionalImage
            src={avatarSrc}
            alt={`${creator.displayName} avatar`}
            className={styles.avatar!}
            placeholderClassName={styles.avatarPlaceholder!}
            width={96}
            height={96}
          />
        </div>

        <h1 className={styles.displayName}>{creator.displayName}</h1>

        {isSubscribed && (
          <span className={styles.subscribedBadge} aria-label="You are subscribed to this creator">
            ★ Subscribed
          </span>
        )}

        {showFediverseUI && (
          <FediverseAddress
            handle={creator.handle!}
            domain={FEDERATION_DOMAIN}
            size="sm"
          />
        )}

        {creator.bio && (
          <div className={styles.bio}>
            {creator.bio.split("\n\n").map((paragraph, index) => (
              <p key={index} className={styles.bioParagraph}>
                {paragraph}
              </p>
            ))}
          </div>
        )}

        {/* Manage Link (stakeholders and admins) */}
        {canManage && (
          <Link
            to="/creators/$creatorId/manage"
            params={{ creatorId: creator.handle ?? creator.id }}
            className={styles.manageLink}
          >
            Manage
          </Link>
        )}

        {/* Subscribe Action */}
        {plans && plans.length > 0 && isSubscribed && (
          <button
            type="button"
            className={`${buttonStyles.primaryButton} ${styles.subscribeButton} ${styles.subscribedButton}`}
            disabled
            aria-label="Already subscribed to this creator"
          >
            Subscribed
          </button>
        )}

        {plans && plans.length > 0 && !isSubscribed && !isAuthenticated && (
          <Link to="/login" className={`${buttonStyles.primaryButtonLink} ${styles.loginLink}`}>
            Subscribe
          </Link>
        )}

        {plans && plans.length > 0 && !isSubscribed && isAuthenticated && plans.length === 1 && (
          <button
            type="button"
            className={`${buttonStyles.primaryButton} ${styles.subscribeButton}`}
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
              className={`${buttonStyles.primaryButton} ${styles.subscribeButton}`}
              onClick={() => {
                void handleCheckout(selectedPlanId ?? plans[0]!.id);
              }}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? "Subscribing..." : "Subscribe"}
            </button>
          </div>
        )}
        {showFediverseUI && (
          <>
            <button
              type="button"
              className={styles.followFediverseButton}
              onClick={() => setFollowDialogOpen(true)}
            >
              Follow on Fediverse
            </button>
            <FollowFediverseDialog
              handle={creator.handle!}
              domain={FEDERATION_DOMAIN}
              open={followDialogOpen}
              onClose={() => setFollowDialogOpen(false)}
            />
          </>
        )}
      </div>
    </header>
  );
}
