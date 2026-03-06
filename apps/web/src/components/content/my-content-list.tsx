import type React from "react";
import type { FeedItem } from "@snc/shared";

import { ContentCard } from "./content-card.js";
import { useCursorPagination } from "../../hooks/use-cursor-pagination.js";
import listingStyles from "../../styles/listing-page.module.css";

// ── Public Types ──

export interface MyContentListProps {
  readonly creatorId: string;
  readonly refreshKey: number;
}

// ── Public API ──

export function MyContentList({
  creatorId,
  refreshKey,
}: MyContentListProps): React.ReactElement {
  const { items, nextCursor, isLoading, error, loadMore } =
    useCursorPagination<FeedItem>({
      buildUrl: (cursor) => {
        const params = new URLSearchParams();
        params.set("creatorId", creatorId);
        params.set("limit", "12");
        if (cursor) params.set("cursor", cursor);
        return `/api/content?${params.toString()}`;
      },
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
          <ContentCard key={item.id} item={item} />
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
