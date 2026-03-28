import type React from "react";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";
import { Link } from "@tanstack/react-router";

import { VideoDetailView } from "./video-detail-view.js";
import { AudioDetailView } from "./audio-detail-view.js";
import { WrittenDetailView } from "./written-detail-view.js";
import styles from "./content-detail.module.css";

// ── Public Types ──

export interface ContentDetailProps {
  readonly item: FeedItem;
  readonly plans: readonly SubscriptionPlan[];
  readonly canManage?: boolean;
}

// ── Private Helpers ──

function isContentLocked(item: FeedItem): boolean {
  return item.visibility === "subscribers" && item.mediaUrl === null && item.body === null;
}

// ── Public API ──

/** Dispatch content detail rendering by type. Consumption-only — no edit controls. */
export function ContentDetail({ item, plans, canManage }: ContentDetailProps): React.ReactElement {
  const locked = isContentLocked(item);

  return (
    <article className={styles.detailPage}>
      {item.type === "video" && (
        <VideoDetailView item={item} locked={locked} plans={plans} />
      )}
      {item.type === "audio" && (
        <AudioDetailView item={item} locked={locked} plans={plans} />
      )}
      {item.type === "written" && (
        <WrittenDetailView item={item} locked={locked} plans={plans} />
      )}

      {canManage && (
        <Link
          to="/creators/$creatorId/manage/content/$contentId"
          params={{
            creatorId: item.creatorHandle ?? item.creatorId,
            contentId: item.id,
          }}
          className={styles.editLink}
        >
          Manage
        </Link>
      )}
    </article>
  );
}
