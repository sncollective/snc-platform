import type React from "react";
import { useState } from "react";
import type { ContentType, FeedItem } from "@snc/shared";
import { CONTENT_TYPES } from "@snc/shared";

import { useCursorPagination } from "../../hooks/use-cursor-pagination.js";
import { getVisibleColumns, buildGridTemplate } from "./management-columns.js";
import { ContentSection } from "./content-section.js";

import styles from "./content-management-list.module.css";

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
