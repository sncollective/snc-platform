import type React from "react";
import { useState } from "react";

import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { ContentMeta } from "./content-meta.js";
import { ContentFooter } from "./content-footer.js";

import styles from "./audio-locked-view.module.css";

// ── Public Types ──

export interface AudioLockedViewProps {
  readonly item: FeedItem;
  readonly plans?: readonly SubscriptionPlan[];
}

// ── Public API ──

/** Locked-state view for audio content. Shown when subscription access is required. */
export function AudioLockedView({ item, plans }: AudioLockedViewProps): React.ReactElement {
  const [lockedImgBroken, setLockedImgBroken] = useState(false);
  const coverArtSrc = item.thumbnailUrl;

  return (
    <>
      <div className={styles.header}>
        {coverArtSrc && !lockedImgBroken ? (
          <img
            src={coverArtSrc}
            alt={`Thumbnail for ${item.title}`}
            className={styles.coverArt}
            width={280}
            height={280}
            onError={() => setLockedImgBroken(true)}
          />
        ) : (
          <div className={styles.coverArtPlaceholder} />
        )}
        <div className={styles.trackInfo}>
          <ContentMeta
            title={item.title}
            creatorName={item.creatorName}
            publishedAt={item.publishedAt}
          />
          <p className={styles.lockedText}>Subscribe to listen</p>
        </div>
      </div>
      <ContentFooter
        description={item.description}
        creatorId={item.creatorId}
        contentType="audio"
        locked
        plans={plans}
      />
    </>
  );
}
