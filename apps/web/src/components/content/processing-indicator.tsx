import type React from "react";

import type { ProcessingStatus } from "@snc/shared";

import styles from "./processing-indicator.module.css";

// ── Private Constants ──

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Preparing...",
  processing: "Processing media...",
  ready: "Ready",
  failed: "Processing failed",
};

// ── Public API ──

/** Renders an inline status badge for media processing state. Returns null when status is ready or absent. */
export function ProcessingIndicator({
  status,
}: {
  readonly status: ProcessingStatus | null;
}): React.ReactElement | null {
  if (!status || status === "ready") return null;

  return (
    <span className={styles[status] ?? styles.default}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
