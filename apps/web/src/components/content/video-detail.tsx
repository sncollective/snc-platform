import type React from "react";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { VideoPlayer } from "../media/video-player.js";
import { ContentMeta } from "./content-meta.js";
import { ContentFooter } from "./content-footer.js";
import styles from "./video-detail.module.css";

// ── Public Types ──

export interface VideoDetailProps {
  readonly item: FeedItem;
  readonly locked?: boolean;
  readonly plans?: readonly SubscriptionPlan[];
}

// ── Public API ──

export function VideoDetail({
  item,
  locked,
  plans,
}: VideoDetailProps): React.ReactElement {
  const posterSrc = item.thumbnailUrl;

  if (locked === true) {
    return (
      <div className={styles.videoDetail}>
        <div className={styles.lockedOverlayContainer}>
          {posterSrc ? (
            <img
              src={posterSrc}
              alt={`Thumbnail for ${item.title}`}
              className={styles.lockedThumbnail}
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
      </div>
    );
  }

  if (item.mediaUrl === null) {
    return (
      <div className={styles.videoDetail}>
        <div className={styles.mediaUnavailable}>
          <p className={styles.mediaUnavailableText}>Media not yet available</p>
        </div>
        <div className={styles.meta}>
          <ContentMeta
            title={item.title}
            creatorName={item.creatorName}
            publishedAt={item.publishedAt}
          />
        </div>
        <ContentFooter description={item.description} />
      </div>
    );
  }

  const mediaSrc = item.mediaUrl;

  return (
    <div className={styles.videoDetail}>
      <VideoPlayer src={mediaSrc} {...(posterSrc !== null ? { poster: posterSrc } : {})} />
      <div className={styles.meta}>
        <ContentMeta
          title={item.title}
          creatorName={item.creatorName}
          publishedAt={item.publishedAt}
        />
      </div>
      <ContentFooter description={item.description} />
    </div>
  );
}
