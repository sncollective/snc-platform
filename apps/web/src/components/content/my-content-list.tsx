import { useState } from "react";
import type React from "react";
import type { FeedItem } from "@snc/shared";

import { ContentCard } from "./content-card.js";
import { useCursorPagination } from "../../hooks/use-cursor-pagination.js";
import { deleteContent } from "../../lib/content.js";
import listingStyles from "../../styles/listing-page.module.css";
import styles from "./my-content-list.module.css";

// ── Public Types ──

export interface MyContentListProps {
  readonly creatorId: string;
  readonly refreshKey: number;
  readonly onDeleted?: () => void;
}

// ── Public API ──

export function MyContentList({
  creatorId,
  refreshKey,
  onDeleted,
}: MyContentListProps): React.ReactElement {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this content?")) return;
    setDeletingId(id);
    try {
      await deleteContent(id);
      onDeleted?.();
    } catch {
      // Silently ignore — list will still refresh
    } finally {
      setDeletingId(null);
    }
  };

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
          <div key={item.id} className={styles.contentItemWrapper}>
            <ContentCard item={item} />
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
