import { Link } from "@tanstack/react-router";
import type React from "react";
import type { CreatorListItem } from "@snc/shared";

import { formatRelativeDate } from "../../lib/format.js";
import { OptionalImage } from "../ui/optional-image.js";
import styles from "./creator-card.module.css";

// ── Public Types ──

export interface CreatorCardProps {
  readonly creator: CreatorListItem;
  readonly viewMode?: "grid" | "list";
}

// ── Public API ──

export function CreatorCard({ creator, viewMode = "grid" }: CreatorCardProps): React.ReactElement {
  const avatarSrc = creator.avatarUrl;

  if (viewMode === "list") {
    return (
      <div className={styles.listItem}>
        <Link
          to="/creators/$creatorId"
          params={{ creatorId: creator.id }}
          className={styles.listItemLink}
        >
          <div className={styles.listAvatarWrapper}>
            <OptionalImage
              src={avatarSrc}
              alt={`${creator.displayName} avatar`}
              className={styles.listAvatar!}
              placeholderClassName={styles.listAvatarPlaceholder!}
              loading="lazy"
            />
          </div>
          <span className={styles.listDisplayName}>
            {creator.displayName}
            {creator.isSubscribed && (
              <span className={styles.subscribedStar} aria-label="Subscribed">
                ★
              </span>
            )}
          </span>
          <span className={styles.listContentCount}>
            {creator.contentCount} {creator.contentCount === 1 ? "post" : "posts"}
          </span>
          {creator.subscriberCount !== undefined && (
            <span className={styles.listMeta}>
              {creator.subscriberCount} {creator.subscriberCount === 1 ? "subscriber" : "subscribers"}
            </span>
          )}
          {creator.lastPublishedAt !== undefined && creator.lastPublishedAt !== null && (
            <span className={styles.listMeta}>
              Last post {formatRelativeDate(creator.lastPublishedAt)}
            </span>
          )}
        </Link>
        {creator.canManage && (
          <Link
            to="/creators/$creatorId/manage"
            params={{ creatorId: creator.id }}
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
        params={{ creatorId: creator.id }}
        className={styles.cardLink}
      >
        <div className={styles.avatarWrapper}>
          <OptionalImage
            src={avatarSrc}
            alt={`${creator.displayName} avatar`}
            className={styles.avatar!}
            placeholderClassName={styles.avatarPlaceholder!}
            loading="lazy"
          />
        </div>
        <div className={styles.info}>
          <h3 className={styles.displayName}>
            {creator.displayName}
            {creator.isSubscribed && (
              <span className={styles.subscribedStar} aria-label="Subscribed">
                ★
              </span>
            )}
          </h3>
          {creator.bio && (
            <p className={styles.bio}>{creator.bio}</p>
          )}
          <span className={styles.contentCount}>
            {creator.contentCount} {creator.contentCount === 1 ? "post" : "posts"}
          </span>
        </div>
      </Link>
      {creator.canManage && (
        <Link
          to="/creators/$creatorId/manage"
          params={{ creatorId: creator.id }}
          className={styles.manageLink}
        >
          Manage
        </Link>
      )}
    </div>
  );
}
