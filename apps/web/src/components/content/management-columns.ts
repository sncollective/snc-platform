import type { ContentType, FeedItem } from "@snc/shared";

// ── Column Definition ──

export interface ManagementColumn {
  /** Unique key for React key and CSS targeting. */
  readonly key: string;
  /** Column header label. */
  readonly label: string;
  /** Which content types show this column. "all" = always visible. */
  readonly types: readonly ContentType[] | "all";
  /** CSS width hint (used in grid-template-columns). */
  readonly width: string;
}

// ── Column Registry (Single Source of Truth) ──

const MANAGEMENT_COLUMNS = [
  { key: "title", label: "Title", types: "all", width: "1fr" },
  { key: "type", label: "Type", types: "all", width: "5rem" },
  { key: "status", label: "Status", types: "all", width: "6rem" },
  { key: "date", label: "Date", types: "all", width: "7rem" },
  { key: "visibility", label: "Access", types: "all", width: "6.5rem" },
  { key: "duration", label: "Duration", types: ["audio", "video"] as readonly ContentType[], width: "5.5rem" },
  { key: "processing", label: "Processing", types: ["audio", "video"] as readonly ContentType[], width: "7rem" },
] as const satisfies readonly ManagementColumn[];

export type ColumnKey = (typeof MANAGEMENT_COLUMNS)[number]["key"];

// ── Column Helpers ──

/** Filter columns to those visible for a given type filter. "all" shows only base columns; a specific type adds type-specific columns. */
export function getVisibleColumns(
  typeFilter: ContentType | "all",
): readonly ManagementColumn[] {
  return MANAGEMENT_COLUMNS.filter(
    (col) =>
      col.types === "all" ||
      (typeFilter !== "all" &&
        (col.types as readonly string[]).includes(typeFilter)),
  );
}

/** Build CSS grid-template-columns string from visible columns. */
export function buildGridTemplate(columns: readonly ManagementColumn[]): string {
  return columns.map((col) => col.width).join(" ");
}

// ── Cell Value Helpers ──

/** Format duration in seconds to mm:ss display. Returns "—" for null. */
export function formatDuration(seconds: FeedItem["duration"]): string {
  if (seconds === null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
