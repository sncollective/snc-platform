import type React from "react";
import type { PlayoutItem } from "@snc/shared";

import styles from "../../routes/admin/playout.module.css";

// ── Types ──

export interface ProcessingStatusBadgeProps {
  readonly status: PlayoutItem["processingStatus"];
}

// ── Component ──

/** Visual indicator for a playout item's processing status. */
export function ProcessingStatusBadge({
  status,
}: ProcessingStatusBadgeProps): React.ReactElement {
  const classMap: Record<PlayoutItem["processingStatus"], string | undefined> = {
    pending: styles.statusPending,
    uploading: styles.statusUploading,
    processing: styles.statusProcessing,
    ready: styles.statusReady,
    failed: styles.statusFailed,
  };

  const labelMap: Record<PlayoutItem["processingStatus"], string> = {
    pending: "Pending",
    uploading: "Uploading…",
    processing: "Processing…",
    ready: "Ready",
    failed: "Failed",
  };

  return (
    <span className={classMap[status]} aria-label={`Status: ${labelMap[status]}`}>
      {labelMap[status]}
    </span>
  );
}
