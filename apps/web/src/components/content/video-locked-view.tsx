import type React from "react";
import { useState } from "react";

import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { ContentMeta } from "./content-meta.js";
import { ContentFooter } from "./content-footer.js";

import styles from "./video-locked-view.module.css";

// ── Public Types ──

export interface VideoLockedViewProps {
  readonly item: FeedItem;
  readonly plans?: readonly SubscriptionPlan[];
}

// ── Public API ──

/** Locked-state overlay for video content. Shown when subscription access is required. */
export function VideoLockedView({ item, plans }: VideoLockedViewProps): React.ReactElement {
  const [lockedImgBroken, setLockedImgBroken] = useState(false);
  const posterSrc = item.thumbnailUrl;

  return (
    <>
      <div className={styles.lockedOverlayContainer}>
        {posterSrc && !lockedImgBroken ? (
          <img
            src={posterSrc}
            alt={`Thumbnail for ${item.title}`}
            className={styles.lockedThumbnail}
            onError={() => setLockedImgBroken(true)}
          />
        ) : (
          <div className={styles.lockedThumbnailPlaceholder} />
        )}
        <div className={styles.lockedOverlay}>
          <span className={styles.lockIcon} aria-hidden="true">
            &#x1F512;
          </span>
          <span className={styles.lockedText}>Subscribe to watch</span>
        </div>
      </div>
      <div className={styles.meta}>
        <ContentMeta
          title={item.title}
          creatorName={item.creatorName}
          publishedAt={item.publishedAt}
        />
      </div>
      <ContentFooter
        description={item.description}
        creatorId={item.creatorId}
        contentType="video"
        locked
        plans={plans}
      />
    </>
  );
}
