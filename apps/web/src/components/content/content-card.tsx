import { Link } from "@tanstack/react-router";
import type React from "react";
import type { FeedItem } from "@snc/shared";

import { formatRelativeDate } from "../../lib/format.js";
import { OptionalImage } from "../ui/optional-image.js";
import styles from "./content-card.module.css";

// ── Constants ──

const TYPE_BADGE_LABELS: Record<FeedItem["type"], string> = {
  video: "VIDEO",
  audio: "AUDIO",
  written: "POST",
};

const TYPE_BADGE_CLASSES: Record<FeedItem["type"], string> = {
  video: styles.badgeVideo!,
  audio: styles.badgeAudio!,
  written: styles.badgeWritten!,
};

// ── Public Types ──

export interface ContentCardProps {
  readonly item: FeedItem;
}

// ── Public API ──

export function ContentCard({ item }: ContentCardProps): React.ReactElement {
  const thumbnailSrc = item.thumbnailUrl;

  const badgeClass = TYPE_BADGE_CLASSES[item.type];
  const hasThumbnail = thumbnailSrc !== null;

  const linkProps =
    item.slug && item.creatorHandle
      ? ({
          to: "/content/$creatorSlug/$contentSlug",
          params: { creatorSlug: item.creatorHandle, contentSlug: item.slug },
        } as const)
      : ({
          to: "/content/$contentId",
          params: { contentId: item.id },
        } as const);

  return (
    <Link
      {...linkProps}
      className={hasThumbnail ? styles.card : `${styles.card} ${styles.cardNoThumbnail}`}
    >
      {hasThumbnail ? (
        <div className={styles.thumbnailWrapper}>
          <OptionalImage
            src={thumbnailSrc}
            alt={item.title}
            className={styles.thumbnail!}
            placeholderClassName={styles.thumbnailPlaceholder!}
            loading="lazy"
          />
          <span className={`${styles.badge} ${badgeClass}`}>
            {TYPE_BADGE_LABELS[item.type]}
          </span>
          {item.visibility === "subscribers" && !item.mediaUrl && !item.body && (
            <span className={styles.lockOverlay} aria-label="Subscribers only">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M11 7V5a3 3 0 0 0-6 0v2H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1ZM7 5a1 1 0 1 1 2 0v2H7V5Z" />
              </svg>
            </span>
          )}
        </div>
      ) : (
        <div className={styles.noThumbnailHeader}>
          <span className={`${styles.badge} ${styles.badgeInline} ${badgeClass}`}>
            {TYPE_BADGE_LABELS[item.type]}
          </span>
          {item.visibility === "subscribers" && !item.mediaUrl && !item.body && (
            <span className={styles.lockInline} aria-label="Subscribers only">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M11 7V5a3 3 0 0 0-6 0v2H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1ZM7 5a1 1 0 1 1 2 0v2H7V5Z" />
              </svg>
            </span>
          )}
        </div>
      )}
      <div className={styles.info}>
        <h3 className={styles.title}>{item.title}</h3>
        <span className={styles.creator}>{item.creatorName}</span>
        {item.publishedAt && (
          <time className={styles.date} dateTime={item.publishedAt}>
            {formatRelativeDate(item.publishedAt)}
          </time>
        )}
      </div>
    </Link>
  );
}
