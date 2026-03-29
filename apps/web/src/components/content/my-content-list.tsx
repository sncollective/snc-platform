import type React from "react";
import type { FeedItem } from "@snc/shared";

import { ContentCard } from "./content-card.js";
import { ProcessingIndicator } from "./processing-indicator.js";
import { useCursorPagination } from "../../hooks/use-cursor-pagination.js";
import { useContentDelete } from "../../hooks/use-content-delete.js";
import { buildContentListUrl } from "../../lib/content-url.js";
import listingStyles from "../../styles/listing-page.module.css";
import styles from "./my-content-list.module.css";

// ── Public Types ──

export interface MyContentListProps {
  readonly creatorId: string;
  readonly refreshKey: number;
  readonly onDeleted?: () => void;
}

// ── Public API ──

/** Paginated grid of a creator's published content with per-item delete action and cursor-based load-more. */
export function MyContentList({
  creatorId,
  refreshKey,
  onDeleted,
}: MyContentListProps): React.ReactElement {
  const { deletingId, handleDelete } = useContentDelete({ onDeleted });

  const { items, nextCursor, isLoading, error, loadMore } =
    useCursorPagination<FeedItem>({
      buildUrl: (cursor) =>
        buildContentListUrl("/api/content", { creatorId, cursor }),
      deps: [creatorId, refreshKey],
    });

  if (error) {
    return <p className={listingStyles.status}>{error}</p>;
  }

  if (isLoading && items.length === 0) {
    return <p className={listingStyles.status}>Loading...</p>;
  }

  if (items.length === 0) {
    return <p className={listingStyles.status}>No content yet. Create your first piece above.</p>;
  }

  return (
    <>
      <div className="content-grid">
        {items.map((item) => (
          <div key={item.id} className={styles.contentItemWrapper}>
            <ContentCard item={item} />
            <ProcessingIndicator status={item.processingStatus} />
            <button
              type="button"
              className={styles.deleteButton}
              onClick={() => void handleDelete(item.id)}
              disabled={deletingId === item.id}
            >
              {deletingId === item.id ? "Deleting..." : "Delete"}
            </button>
          </div>
        ))}
      </div>
      {nextCursor && (
        <div className={listingStyles.loadMoreWrapper}>
          <button
            type="button"
            className={listingStyles.loadMoreButton}
            onClick={loadMore}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
