import type React from "react";
import { useEffect } from "react";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { useGlobalPlayer } from "../../contexts/global-player-context.js";
import { ContentMeta } from "./content-meta.js";
import { WrittenLockedPreview } from "./written-locked-preview.js";
import styles from "./written-detail.module.css";

// ── Public Types ──

export interface WrittenDetailViewProps {
  readonly item: FeedItem;
  readonly locked?: boolean;
  readonly plans?: readonly SubscriptionPlan[];
}

// ── Public API ──

/** Consumption-only written content detail. Renders body text and metadata. No player — calls setActiveDetail(null) to keep player collapsed. */
export function WrittenDetailView({ item, locked, plans }: WrittenDetailViewProps): React.ReactElement {
  const { actions } = useGlobalPlayer();

  // Written content doesn't use the player — clear activeDetailId so player stays collapsed if something else is playing
  useEffect(() => {
    actions.setActiveDetail(null);
    return () => actions.setActiveDetail(null);
  }, [actions]);

  if (locked === true) {
    return <WrittenLockedPreview item={item} plans={plans} />;
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
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
