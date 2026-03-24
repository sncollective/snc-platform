import { Link } from "@tanstack/react-router";
import type React from "react";
import type { CreatorListItem } from "@snc/shared";

import { OptionalImage } from "../ui/optional-image.js";
import { RelativeTime } from "../ui/relative-time.js";
import styles from "./creator-card.module.css";

// ── Public Types ──

export interface CreatorCardProps {
  readonly creator: CreatorListItem;
  readonly viewMode?: "grid" | "list";
}

// ── Public API ──

export function CreatorCard({ creator, viewMode = "grid" }: CreatorCardProps): React.ReactElement {
  const avatarSrc = creator.avatarUrl;
  const creatorSlug = creator.handle ?? creator.id;

  const postLabel = `${creator.contentCount} ${creator.contentCount === 1 ? "post" : "posts"}`;

  const subscribedBadge = creator.isSubscribed ? (
    <span className={styles.subscribedStar} aria-label="Subscribed">
      ★
    </span>
  ) : null;

  if (viewMode === "list") {
    return (
      <div className={styles.listItem}>
        <Link
          to="/creators/$creatorId"
          params={{ creatorId: creatorSlug }}
          className={styles.listItemLink}
        >
          <div className={styles.listAvatarWrapper}>
            <OptionalImage
              src={avatarSrc}
              alt={`${creator.displayName} avatar`}
              className={styles.listAvatar!}
              placeholderClassName={styles.listAvatarPlaceholder!}
              loading="lazy"
              width={40}
              height={40}
            />
          </div>
          <span className={styles.listDisplayName}>
            {creator.displayName}
            {subscribedBadge}
          </span>
          <span className={styles.listContentCount}>
            {postLabel}
          </span>
          {creator.subscriberCount !== undefined && (
            <span className={styles.listMeta}>
              {creator.subscriberCount} {creator.subscriberCount === 1 ? "subscriber" : "subscribers"}
            </span>
          )}
          {creator.lastPublishedAt !== undefined && creator.lastPublishedAt !== null && (
            <RelativeTime dateTime={creator.lastPublishedAt} className={styles.listMeta} prefix="Last post " />
          )}
        </Link>
        {creator.canManage && (
          <Link
            to="/creators/$creatorId/manage"
            params={{ creatorId: creatorSlug }}
            className={styles.manageLink}
          >
            Manage
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <Link
        to="/creators/$creatorId"
        params={{ creatorId: creatorSlug }}
        className={styles.cardLink}
      >
        <div className={styles.avatarWrapper}>
          <OptionalImage
            src={avatarSrc}
            alt={`${creator.displayName} avatar`}
            className={styles.avatar!}
            placeholderClassName={styles.avatarPlaceholder!}
            loading="lazy"
            width={80}
            height={80}
          />
        </div>
        <div className={styles.info}>
          <h3 className={styles.displayName}>
            {creator.displayName}
            {subscribedBadge}
          </h3>
          {creator.bio && (
            <p className={styles.bio}>{creator.bio}</p>
          )}
          <span className={styles.contentCount}>
            {postLabel}
          </span>
        </div>
      </Link>
      {creator.canManage && (
        <Link
          to="/creators/$creatorId/manage"
          params={{ creatorId: creatorSlug }}
          className={styles.manageLink}
        >
          Manage
        </Link>
      )}
    </div>
  );
}
