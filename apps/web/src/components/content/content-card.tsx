import { Link } from "@tanstack/react-router";
import type React from "react";
import type { FeedItem } from "@snc/shared";

import { clsx } from "clsx/lite";
import { Lock } from "lucide-react";

import { OptionalImage } from "../ui/optional-image.js";
import { RelativeTime } from "../ui/relative-time.js";
import { TYPE_BADGE_LABELS } from "../../lib/content-constants.js";
import styles from "./content-card.module.css";

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
  const thumbnailSrc = item.thumbnail?.src ?? item.thumbnailUrl;
  const thumbnailSrcSet = item.thumbnail?.srcSet ?? null;
  const thumbnailSizes = item.thumbnail?.sizes ?? null;

  const badgeClass = TYPE_BADGE_CLASSES[item.type];
  const hasThumbnail = thumbnailSrc !== null;

  const cardClass = clsx(styles.card, !hasThumbnail && styles.cardNoThumbnail);

  const children = (
    <>
      {hasThumbnail ? (
        <div className={styles.thumbnailWrapper}>
          <OptionalImage
            src={thumbnailSrc}
            alt={item.title}
            className={styles.thumbnail!}
            placeholderClassName={styles.thumbnailPlaceholder!}
            loading="lazy"
            srcSet={thumbnailSrcSet}
            sizes={thumbnailSizes}
          />
          <span className={clsx(styles.badge, badgeClass)}>
            {TYPE_BADGE_LABELS[item.type]}
          </span>
          {item.visibility === "subscribers" && !item.mediaUrl && !item.body && (
            <span className={styles.lockOverlay} aria-label="Subscribers only">
              <Lock size={16} aria-hidden="true" />
            </span>
          )}
        </div>
      ) : (
        <div className={styles.noThumbnailHeader}>
          <span className={clsx(styles.badge, styles.badgeInline, badgeClass)}>
            {TYPE_BADGE_LABELS[item.type]}
          </span>
          {item.visibility === "subscribers" && !item.mediaUrl && !item.body && (
            <span className={styles.lockInline} aria-label="Subscribers only">
              <Lock size={14} aria-hidden="true" />
            </span>
          )}
        </div>
      )}
      <div className={styles.info}>
        <h3 className={styles.title}>{item.title}</h3>
        <span className={styles.creator}>{item.creatorName}</span>
        {item.publishedAt && (
          <RelativeTime dateTime={item.publishedAt} className={styles.date} />
        )}
      </div>
    </>
  );

  if (item.slug && item.creatorHandle) {
    return (
      <Link
        to="/content/$creatorSlug/$contentSlug"
        params={{ creatorSlug: item.creatorHandle, contentSlug: item.slug }}
        className={cardClass}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      to="/content/$contentId"
      params={{ contentId: item.id }}
      className={cardClass}
    >
      {children}
    </Link>
  );
}
