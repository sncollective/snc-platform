import type React from "react";
import { Link } from "@tanstack/react-router";
import type { FeedItem } from "@snc/shared";

import { TYPE_BADGE_LABELS } from "../../lib/content-constants.js";
import { formatRelativeDate } from "../../lib/format.js";
import { ProcessingIndicator } from "./processing-indicator.js";
import { formatDuration } from "./management-columns.js";
import type { ManagementColumn } from "./management-columns.js";
import { KebabMenu } from "./kebab-menu.js";
import { clsx } from "clsx/lite";

import styles from "./content-management-list.module.css";

// ── Public Types ──

export interface ContentRowProps {
  readonly item: FeedItem;
  readonly columns: readonly ManagementColumn[];
  readonly gridTemplate: string;
  readonly creatorSlug: string;
  readonly deletingId: string | null;
  readonly onDelete: (id: string) => void;
}

// ── Private Helpers ──

function buildCellRenderers(
  creatorSlug: string,
  deletingId: string | null,
  onDelete: (id: string) => void,
): Record<string, (item: FeedItem) => React.ReactNode> {
  return {
    title: (item) => (
      <Link
        to="/creators/$creatorId/manage/content/$contentId"
        params={{
          creatorId: creatorSlug,
          contentId: item.slug ?? item.id,
        }}
        className={styles.cellTitle}
      >
        {item.title}
      </Link>
    ),
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
        <KebabMenu itemId={item.id} deletingId={deletingId} onDelete={onDelete} />
      </div>
    ),
  };
}

// ── Public API ──

/** Single content management row rendering adaptive columns and an actions cell. */
export function ContentRow({
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
