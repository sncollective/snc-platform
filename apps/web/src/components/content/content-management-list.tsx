import type React from "react";
import { useState, useRef, useEffect } from "react";
import type { ContentType, FeedItem } from "@snc/shared";
import { CONTENT_TYPES } from "@snc/shared";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx/lite";

import { useCursorPagination } from "../../hooks/use-cursor-pagination.js";
import { deleteContent } from "../../lib/content.js";
import { formatRelativeDate } from "../../lib/format.js";
import { ProcessingIndicator } from "./processing-indicator.js";
import {
  getVisibleColumns,
  buildGridTemplate,
  formatDuration,
} from "./management-columns.js";
import type { ManagementColumn } from "./management-columns.js";

import styles from "./content-management-list.module.css";
import listingStyles from "../../styles/listing-page.module.css";

// ── Public Types ──

export interface ContentManagementListProps {
  /** Creator ID for API fetches (always UUID). */
  readonly creatorId: string;
  /** Creator handle or ID for link generation. */
  readonly creatorSlug: string;
  /** Trigger refetch when incremented. */
  readonly refreshKey: number;
  /** Called after successful delete. */
  readonly onDeleted: () => void;
}

// ── Private Constants ──

const TYPE_BADGE_LABELS: Record<FeedItem["type"], string> = {
  video: "VIDEO",
  audio: "AUDIO",
  written: "POST",
};

// ── Private Helpers ──

function buildCellRenderers(
  creatorSlug: string,
  deletingId: string | null,
  onDelete: (id: string) => void,
): Record<string, (item: FeedItem) => React.ReactNode> {
  return {
    title: (item) => <span className={styles.cellTitle}>{item.title}</span>,
    type: (item) => (
      <span className={clsx(styles.typeBadge, styles[`typeBadge_${item.type}`])}>
        {TYPE_BADGE_LABELS[item.type]}
      </span>
    ),
    status: (item) => (
      <span
        className={clsx(
          styles.statusBadge,
          item.publishedAt ? styles.statusPublished : styles.statusDraft,
        )}
      >
        {item.publishedAt ? "Published" : "Draft"}
      </span>
    ),
    date: (item) => (
      <time dateTime={item.publishedAt ?? item.createdAt}>
        {formatRelativeDate(item.publishedAt ?? item.createdAt)}
      </time>
    ),
    visibility: (item) => (
      <span>{item.visibility === "public" ? "Public" : "Subscribers"}</span>
    ),
    duration: (item) => <span>{formatDuration(item.duration)}</span>,
    processing: (item) => <ProcessingIndicator status={item.processingStatus} />,
    _actions: (item) => (
      <div className={styles.rowActions}>
        <Link
          to="/creators/$creatorId/manage/content/$contentId"
          params={{
            creatorId: creatorSlug,
            contentId: item.slug ?? item.id,
          }}
          className={styles.editLink}
        >
          Edit
        </Link>
        <KebabMenu itemId={item.id} deletingId={deletingId} onDelete={onDelete} />
      </div>
    ),
  };
}

// ── Private Components ──

interface TypeFilterBarProps {
  readonly value: ContentType | "all";
  readonly onChange: (value: ContentType | "all") => void;
}

function TypeFilterBar({ value, onChange }: TypeFilterBarProps): React.ReactElement {
  return (
    <div className={styles.filterBar}>
      <label className={styles.filterLabel} htmlFor="type-filter">
        Filter by type
      </label>
      <select
        id="type-filter"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "all" || (CONTENT_TYPES as readonly string[]).includes(v)) {
            onChange(v as ContentType | "all");
          }
        }}
        className={styles.filterSelect}
      >
        <option value="all">All</option>
        {CONTENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}

interface KebabMenuProps {
  readonly itemId: string;
  readonly deletingId: string | null;
  readonly onDelete: (id: string) => void;
}

function KebabMenu({ itemId, deletingId, onDelete }: KebabMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className={styles.kebabWrapper} ref={ref}>
      <button
        type="button"
        className={styles.kebabButton}
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
      >
        ⋯
      </button>
      {open && (
        <div className={styles.kebabMenu}>
          <button
            type="button"
            className={styles.deleteAction}
            onClick={() => {
              setOpen(false);
              if (window.confirm("Delete this content? This cannot be undone.")) {
                onDelete(itemId);
              }
            }}
            disabled={deletingId === itemId}
          >
            {deletingId === itemId ? "Deleting..." : "Delete"}
          </button>
        </div>
      )}
    </div>
  );
}

interface ContentRowProps {
  readonly item: FeedItem;
  readonly columns: readonly ManagementColumn[];
  readonly gridTemplate: string;
  readonly creatorSlug: string;
  readonly deletingId: string | null;
  readonly onDelete: (id: string) => void;
}

function ContentRow({
  item,
  columns,
  gridTemplate,
  creatorSlug,
  deletingId,
  onDelete,
}: ContentRowProps): React.ReactElement {
  const cellRenderers = buildCellRenderers(creatorSlug, deletingId, onDelete);
  // Add 1fr for actions column
  const fullTemplate = `${gridTemplate} 5.5rem`;

  return (
    <div
      className={styles.gridRow}
      style={{ gridTemplateColumns: fullTemplate }}
    >
      {columns.map((col) => (
        <div key={col.key} className={styles.gridCell}>
          {cellRenderers[col.key]?.(item)}
        </div>
      ))}
      <div className={styles.gridCell}>{cellRenderers._actions(item)}</div>
    </div>
  );
}

interface ContentSectionProps {
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

function ContentSection({
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

// ── Public API ──

/** Unified management list showing drafts and published content with adaptive columns, type filter, and inline delete. */
export function ContentManagementList({
  creatorId,
  creatorSlug,
  refreshKey,
  onDeleted,
}: ContentManagementListProps): React.ReactElement {
  const [typeFilter, setTypeFilter] = useState<ContentType | "all">("all");
  const columns = getVisibleColumns(typeFilter);
  const gridTemplate = buildGridTemplate(columns);

  const drafts = useCursorPagination<FeedItem>({
    buildUrl: (cursor) => {
      const params = new URLSearchParams();
      params.set("creatorId", creatorId);
      params.set("limit", "12");
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (cursor) params.set("cursor", cursor);
      return `/api/content/drafts?${params.toString()}`;
    },
    deps: [creatorId, refreshKey, typeFilter],
    fetchOptions: { credentials: "include" },
  });

  const published = useCursorPagination<FeedItem>({
    buildUrl: (cursor) => {
      const params = new URLSearchParams();
      params.set("creatorId", creatorId);
      params.set("limit", "12");
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (cursor) params.set("cursor", cursor);
      return `/api/content?${params.toString()}`;
    },
    deps: [creatorId, refreshKey, typeFilter],
  });

  return (
    <div className={styles.managementList}>
      <TypeFilterBar value={typeFilter} onChange={setTypeFilter} />

      <ContentSection
        label="Drafts"
        items={drafts.items}
        columns={columns}
        gridTemplate={gridTemplate}
        creatorSlug={creatorSlug}
        isLoading={drafts.isLoading}
        error={drafts.error}
        nextCursor={drafts.nextCursor}
        onLoadMore={drafts.loadMore}
        onDeleted={onDeleted}
        emptyMessage="No drafts."
      />

      <ContentSection
        label="Published"
        items={published.items}
        columns={columns}
        gridTemplate={gridTemplate}
        creatorSlug={creatorSlug}
        isLoading={published.isLoading}
        error={published.error}
        nextCursor={published.nextCursor}
        onLoadMore={published.loadMore}
        onDeleted={onDeleted}
        emptyMessage="No published content."
      />
    </div>
  );
}
