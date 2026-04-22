import type React from "react";
import type { ActiveUpload } from "../../contexts/upload-context.js";

import styles from "./inline-upload-progress.module.css";

// ── Public Types ──

export interface InlineUploadProgressProps {
  readonly upload: ActiveUpload;
  /** Visual variant matching the content type's layout. */
  readonly variant: "video" | "audio";
}

// ── Public API ──

/** Inline upload progress indicator for the content detail area. Shows filename, progress bar, and percentage. The "completing" status shows "Finalizing..." instead of a percentage. */
export function InlineUploadProgress({
  upload,
  variant,
}: InlineUploadProgressProps): React.ReactElement {
  const containerClass = variant === "video" ? styles.containerVideo : styles.containerAudio;
  const isCompleting = upload.status === "completing";
  const scaleX = upload.progress / 100;

  return (
    <div className={containerClass}>
      <span className={styles.filename}>{upload.filename}</span>
      <div className={styles.progressTrack}>
        <div
          className={styles.progressFill}
          style={{ transform: `scaleX(${scaleX})` }}
          role="progressbar"
          aria-valuenow={upload.progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {isCompleting ? (
        <span className={styles.statusText}>Finalizing...</span>
      ) : (
        <span className={styles.percentage}>{upload.progress}%</span>
      )}
    </div>
  );
}
