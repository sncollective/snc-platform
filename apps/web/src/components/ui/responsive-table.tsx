import type { ReactNode } from "react";
import styles from "./responsive-table.module.css";

// ── Types ──

/**
 * Column definition for ResponsiveTable. One definition drives both the
 * semantic table view and the card list view.
 *
 * Cell renderers must not emit elements carrying `id` attributes — both
 * views are always present in the DOM (dual render for SSR safety), so
 * ids would be duplicated.
 */
export interface ResponsiveTableColumn<T> {
  /** Stable column key (React key for th/cells/card fields). */
  readonly key: string;
  /** Header content (th) — also the card field label when `cardLabel` is unset. */
  readonly header: string;
  /** Cell renderer for a row. Must not emit elements carrying `id` (dual render). */
  readonly cell: (row: T) => ReactNode;
  /** Card treatment: "field" (default) labeled row; "title" card heading; "hidden" table-only. */
  readonly cardRole?: "title" | "field" | "hidden";
  /** Override the card field label (defaults to `header`). */
  readonly cardLabel?: string;
}

/**
 * Props for ResponsiveTable. Drives both a semantic `<table>` and a card
 * `<ul>` from a single column definition, toggled by a self-established
 * CSS container query.
 *
 * Cell renderers must not emit elements carrying `id` attributes — both
 * views are always present in the DOM (dual render for SSR safety), so
 * ids would be duplicated.
 */
export interface ResponsiveTableProps<T> {
  readonly columns: readonly ResponsiveTableColumn<T>[];
  readonly rows: readonly T[];
  /** Stable row key. */
  readonly rowKey: (row: T) => string;
  /** Row actions — last table column ("Actions") and card footer. */
  readonly actions?: (row: T) => ReactNode;
  /** Accessible name for the table and the card list. */
  readonly label: string;
  /**
   * Per-card accessible name (`role="group"`). Pass explicitly for
   * meaningful card names — the component cannot infer text content from
   * cell renderers.
   */
  readonly cardAriaLabel?: (row: T) => string;
  /**
   * Container width at which the table view appears.
   * Maps to breakpoint tokens: sm=640px / md=768px. Default "sm".
   */
  readonly tableAt?: "sm" | "md";
  /**
   * "auto" (default): width-driven container-query toggle.
   * "cards": card list at every width (subsumes variant="list").
   */
  readonly mode?: "auto" | "cards";
}

// ── Component ──

/**
 * Render a semantic table and a card list from a single column definition.
 * Both views are always in the DOM; a CSS container query on the wrapping
 * `<div>` (unnamed `inline-size` container) hides one and shows the other
 * based on the container's width. SSR-safe, no hydration flicker.
 *
 * Cell renderers must not emit elements carrying `id` attributes — both
 * views are always present in the DOM (dual render), so ids would be
 * duplicated.
 *
 * Returns null for empty rows — empty states are consumer-owned.
 */
export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  actions,
  label,
  cardAriaLabel,
  tableAt = "sm",
  mode = "auto",
}: ResponsiveTableProps<T>): React.ReactElement | null {
  if (rows.length === 0) {
    return null;
  }

  const containerClassName = [
    styles.container,
    tableAt === "md" ? styles.tableAtMd : undefined,
    mode === "cards" ? styles.cardsOnly : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClassName}>
      {/* ── Table View (omitted in cards-only mode) ── */}
      {mode !== "cards" && (
      <table className={styles.table} aria-label={label}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={styles.th}>
                {col.header}
              </th>
            ))}
            {actions !== undefined && (
              <th className={styles.th}>
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={styles.row}>
              {columns.map((col) => (
                <td key={col.key} className={styles.td}>
                  {col.cell(row)}
                </td>
              ))}
              {actions !== undefined && (
                <td className={styles.td}>
                  <div className={styles.actions}>{actions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      )}

      {/* ── Card View ── */}
      <ul
        className={styles.cardList}
        aria-label={label}
      >
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className={styles.card}
            role="group"
            {...(cardAriaLabel !== undefined
              ? { "aria-label": cardAriaLabel(row) }
              : {})}
          >
            {columns.map((col) => {
              const role = col.cardRole ?? "field";

              if (role === "hidden") {
                return null;
              }

              if (role === "title") {
                return (
                  <div key={col.key} className={styles.cardTitle}>
                    {col.cell(row)}
                  </div>
                );
              }

              // role === "field"
              return (
                <div key={col.key} className={styles.cardField}>
                  <span className={styles.cardLabel}>
                    {col.cardLabel ?? col.header}
                  </span>
                  <span className={styles.cardValue}>{col.cell(row)}</span>
                </div>
              );
            })}
            {actions !== undefined && (
              <div className={styles.cardActions}>{actions(row)}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
