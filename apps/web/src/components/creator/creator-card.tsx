import { Link } from "@tanstack/react-router";
import type React from "react";
import type { CreatorListItem } from "@snc/shared";

import { OptionalImage } from "../ui/optional-image.js";
import styles from "./creator-card.module.css";

// ── Public Types ──

export interface CreatorCardProps {
  readonly creator: CreatorListItem;
}

// ── Public API ──

export function CreatorCard({ creator }: CreatorCardProps): React.ReactElement {
  const avatarSrc = creator.avatarUrl;

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
          <h3 className={styles.displayName}>{creator.displayName}</h3>
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
