import type React from "react";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { truncateToWords } from "../../lib/format.js";
import { ContentMeta } from "./content-meta.js";
import { SubscribeCta } from "./subscribe-cta.js";
import styles from "./written-detail.module.css";

// ── Private Constants ──

const TRUNCATE_WORD_COUNT = 200;

// ── Public Types ──

export interface WrittenLockedPreviewProps {
  readonly item: FeedItem;
  readonly plans?: readonly SubscriptionPlan[] | undefined;
}

// ── Public API ──

/** Locked preview for subscriber-only written content: truncated body with fade overlay and subscribe CTA. */
export function WrittenLockedPreview({ item, plans }: WrittenLockedPreviewProps): React.ReactElement {
  const previewText = item.body
    ? truncateToWords(item.body, TRUNCATE_WORD_COUNT)
    : "";
  const previewParagraphs = previewText
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0);

  return (
    <div className={styles.writtenDetail}>
      <header className={styles.header}>
        <ContentMeta
          title={item.title}
          creatorName={item.creatorName}
          publishedAt={item.publishedAt}
        />
      </header>
      <hr className={styles.divider} />
      <div className={styles.bodyPreview}>
        <div className={styles.body}>
          {previewParagraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <div className={styles.fadeOverlay} />
      </div>
      <SubscribeCta contentType="written" plans={plans ?? []} />
    </div>
  );
}
