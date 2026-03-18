import { Link } from "@tanstack/react-router";
import type React from "react";

import type { MyCreatorItem, CreatorMemberRole } from "@snc/shared";

import { OptionalImage } from "../ui/optional-image.js";
import styles from "./my-creator-card.module.css";

// ── Private Constants ──

const ROLE_BADGE_CLASS: Record<CreatorMemberRole, string> = {
  owner: styles.roleBadgeOwner!,
  editor: styles.roleBadgeEditor!,
  viewer: styles.roleBadgeViewer!,
};

// ── Public Types ──

export interface MyCreatorCardProps {
  readonly creator: MyCreatorItem;
}

// ── Public API ──

export function MyCreatorCard({ creator }: MyCreatorCardProps): React.ReactElement {
  return (
    <div className={styles.card}>
      <div className={styles.avatarWrapper}>
        <OptionalImage
          src={creator.avatarUrl}
          alt={`${creator.displayName} avatar`}
          className={styles.avatar!}
          placeholderClassName={styles.avatarPlaceholder!}
          loading="lazy"
        />
      </div>
      <div className={styles.info}>
        <div className={styles.nameRow}>
          <Link
            to="/creators/$creatorId"
            params={{ creatorId: creator.id }}
            className={styles.displayName}
          >
            {creator.displayName}
          </Link>
          <span className={`${styles.roleBadge} ${ROLE_BADGE_CLASS[creator.memberRole]}`}>
            {creator.memberRole}
          </span>
        </div>
        {creator.bio && <p className={styles.bio}>{creator.bio}</p>}
        <span className={styles.contentCount}>
          {creator.contentCount} {creator.contentCount === 1 ? "post" : "posts"}
        </span>
      </div>
      <Link
        to="/creators/$creatorId/manage"
        params={{ creatorId: creator.id }}
        className={styles.manageLink}
      >
        Manage
      </Link>
    </div>
  );
}
