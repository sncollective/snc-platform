import type React from "react";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { truncateToWords } from "../../lib/format.js";
import { ContentMeta } from "./content-meta.js";
import { SubscribeCta } from "./subscribe-cta.js";
import styles from "./written-detail.module.css";

// ── Public Types ──

export interface WrittenDetailProps {
  readonly item: FeedItem;
  readonly locked?: boolean;
  readonly plans?: readonly SubscriptionPlan[];
}

// ── Private Constants ──

const TRUNCATE_WORD_COUNT = 200;

// ── Public API ──

export function WrittenDetail({
  item,
  locked,
  plans,
}: WrittenDetailProps): React.ReactElement {
  if (locked === true) {
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
            {previewParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className={styles.fadeOverlay} />
        </div>
        <SubscribeCta creatorId={item.creatorId} contentType="written" plans={plans ?? []} />
      </div>
    );
  }

  const paragraphs = item.body
    ? item.body.split(/\n\n+/).filter((p) => p.trim().length > 0)
    : [];

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
      <div className={styles.body}>
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
