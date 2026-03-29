import type React from "react";
import { useState } from "react";
import type { FeedItem } from "@snc/shared";

import { deleteContent } from "../../lib/content.js";
import type { ManagementColumn } from "./management-columns.js";
import { ContentRow } from "./content-row.js";

import styles from "./content-management-list.module.css";
import listingStyles from "../../styles/listing-page.module.css";

// ── Public Types ──

export interface ContentSectionProps {
  readonly label: string;
  readonly items: readonly FeedItem[];
  readonly columns: readonly ManagementColumn[];
  readonly gridTemplate: string;
  readonly creatorSlug: string;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly nextCursor: string | null;
  readonly onLoadMore: () => void;
  readonly onDeleted: () => void;
  readonly emptyMessage: string;
}

// ── Public API ──

/** Labelled content section with a grid header, rows, load-more pagination, and per-row delete. */
export function ContentSection({
  label,
  items,
  columns,
  gridTemplate,
  creatorSlug,
  isLoading,
  error,
  nextCursor,
  onLoadMore,
  onDeleted,
  emptyMessage,
}: ContentSectionProps): React.ReactElement {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteContent(id);
      onDeleted();
    } catch {
      // silently reset — error visible via empty list
    } finally {
      setDeletingId(null);
    }
  };

  const fullTemplate = `${gridTemplate} 5.5rem`;

  return (
    <div className={styles.contentSection}>
      <h3 className={styles.sectionHeading}>{label}</h3>
      {error && <p className={styles.errorMessage}>{error}</p>}
      {items.length > 0 ? (
        <>
          <div
            className={styles.gridHeader}
            style={{ gridTemplateColumns: fullTemplate }}
          >
            {columns.map((col) => (
              <span key={col.key}>{col.label}</span>
            ))}
            <span />
          </div>
          {items.map((item) => (
            <ContentRow
              key={item.id}
              item={item}
              columns={columns}
              gridTemplate={gridTemplate}
              creatorSlug={creatorSlug}
              deletingId={deletingId}
              onDelete={(id) => void handleDelete(id)}
            />
          ))}
        </>
      ) : (
        !isLoading && <p className={styles.emptyMessage}>{emptyMessage}</p>
      )}
      {isLoading && <p className={styles.loadingMessage}>Loading...</p>}
      {nextCursor && (
        <div className={listingStyles.loadMoreWrapper}>
          <button
            type="button"
            className={listingStyles.loadMoreButton}
            onClick={onLoadMore}
            disabled={isLoading}
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
