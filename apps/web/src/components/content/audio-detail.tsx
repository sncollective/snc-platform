import type React from "react";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { AudioPlayer } from "../media/audio-player.js";
import { ContentMeta } from "./content-meta.js";
import { ContentFooter } from "./content-footer.js";
import styles from "./audio-detail.module.css";

// ── Public Types ──

export interface AudioDetailProps {
  readonly item: FeedItem;
  readonly locked?: boolean;
  readonly plans?: readonly SubscriptionPlan[];
}

// ── Public API ──

export function AudioDetail({
  item,
  locked,
  plans,
}: AudioDetailProps): React.ReactElement {
  const coverArtSrc = item.coverArtUrl;

  if (locked === true) {
    return (
      <div className={styles.audioDetail}>
        <div className={styles.header}>
          {coverArtSrc ? (
            <img
              src={coverArtSrc}
              alt={`Cover art for ${item.title}`}
              className={styles.coverArt}
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
      </div>
    );
  }

  if (item.mediaUrl === null) {
    return (
      <div className={styles.audioDetail}>
        <div className={styles.header}>
          {coverArtSrc !== null ? (
            <img className={styles.coverArt} src={coverArtSrc} alt={`Cover art for ${item.title}`} />
          ) : (
            <div className={styles.coverArtPlaceholder} />
          )}
          <div className={styles.trackInfo}>
            <ContentMeta
              title={item.title}
              creatorName={item.creatorName}
              publishedAt={item.publishedAt}
            />
            <p className={styles.mediaUnavailableText}>Media not yet available</p>
          </div>
        </div>
        <ContentFooter description={item.description} />
      </div>
    );
  }

  const mediaSrc = item.mediaUrl;

  return (
    <div className={styles.audioDetail}>
      <div className={styles.header}>
        {coverArtSrc ? (
          <img
            src={coverArtSrc}
            alt={`Cover art for ${item.title}`}
            className={styles.coverArt}
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
          <div className={styles.playerWrapper}>
            <AudioPlayer
              src={mediaSrc}
              title={item.title}
              creator={item.creatorName}
              {...(coverArtSrc !== null ? { coverArtUrl: coverArtSrc } : {})}
              contentId={item.id}
            />
          </div>
        </div>
      </div>
      <ContentFooter description={item.description} />
    </div>
  );
}
