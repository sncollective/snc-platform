import { config } from "../config.js";
import type { playoutItems } from "../db/schema/playout.schema.js";

// ── Rendition Column Mapping ──

/** Rendition column mapping — used by the ingest handler to update the correct column. */
export const RENDITION_COLUMNS = {
  "1080p": "rendition1080pKey",
  "720p": "rendition720pKey",
  "480p": "rendition480pKey",
  audio: "renditionAudioKey",
} as const satisfies Record<string, keyof typeof playoutItems.$inferSelect>;

// ── Rendition URI Selection ──

/**
 * Select the best available rendition URI for playout.
 * Preference: 1080p → 720p → 480p → source.
 */
export const selectPlayoutRenditionUri = (
  row: typeof playoutItems.$inferSelect,
): string | null => {
  const bucket = config.S3_BUCKET ?? "snc-storage";
  if (row.rendition1080pKey) return `s3://${bucket}/${row.rendition1080pKey}`;
  if (row.rendition720pKey) return `s3://${bucket}/${row.rendition720pKey}`;
  if (row.rendition480pKey) return `s3://${bucket}/${row.rendition480pKey}`;
  if (row.sourceKey) return `s3://${bucket}/${row.sourceKey}`;
  return null;
};
