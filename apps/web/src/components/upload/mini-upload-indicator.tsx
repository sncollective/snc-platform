import { useEffect, useRef } from "react";
import type React from "react";

import { useUpload } from "../../contexts/upload-context.js";
import styles from "./mini-upload-indicator.module.css";

// ── Constants ──

const INDICATOR_HEIGHT = "48px";
const AUTO_DISMISS_MS = 3000;

// ── Public API ──

export function MiniUploadIndicator(): React.ReactElement | null {
  const { state, actions } = useUpload();
  const { activeUploads, isUploading, isExpanded } = state;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manage --mini-upload-height CSS custom property
  useEffect(() => {
    if (activeUploads.length > 0) {
      document.body.style.setProperty("--mini-upload-height", INDICATOR_HEIGHT);
    } else {
      document.body.style.setProperty("--mini-upload-height", "0px");
    }
    return () => {
      document.body.style.setProperty("--mini-upload-height", "0px");
    };
  }, [activeUploads.length]);

  // Auto-dismiss completed uploads after 3s
  useEffect(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    const allDone = activeUploads.length > 0 && !isUploading;
    if (allDone) {
      dismissTimerRef.current = setTimeout(() => {
        actions.dismissCompleted();
      }, AUTO_DISMISS_MS);
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [activeUploads, isUploading, actions]);

  if (activeUploads.length === 0) {
    return null;
  }

  const uploadingCount = activeUploads.filter((u) => u.status === "uploading" || u.status === "completing").length;
  const completedCount = activeUploads.filter((u) => u.status === "complete").length;
  const errorCount = activeUploads.filter((u) => u.status === "error").length;

  const avgProgress =
    uploadingCount > 0
      ? Math.round(
          activeUploads
            .filter((u) => u.status === "uploading")
            .reduce((sum, u) => sum + u.progress, 0) / uploadingCount,
        )
      : 100;

  // Compact summary text
  const summaryText = isUploading
    ? uploadingCount === 1
      ? `Uploading ${activeUploads.find((u) => u.status === "uploading")?.filename ?? "file"} — ${avgProgress}%`
      : `Uploading ${uploadingCount} files — ${avgProgress}%`
    : errorCount > 0
      ? `${completedCount} complete, ${errorCount} failed`
      : "Upload complete";

  return (
    <div className={styles.indicator} role="status" aria-label="Upload progress">
      <div className={styles.compact}>
        <span className={styles.summary}>{summaryText}</span>
        <div className={styles.compactActions}>
          {isUploading && (
            <button
              type="button"
              className={styles.cancelButton}
              onClick={actions.cancelAll}
            >
              Cancel all
            </button>
          )}
          {!isUploading && (
            <button
              type="button"
              className={styles.dismissButton}
              onClick={actions.dismissCompleted}
            >
              Dismiss
            </button>
          )}
          <button
            type="button"
            className={styles.expandButton}
            onClick={actions.toggleExpanded}
            aria-expanded={isExpanded}
          >
            {isExpanded ? "▼" : "▲"}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.expanded}>
          {activeUploads.map((upload) => (
            <div key={upload.id} className={styles.fileRow}>
              <span className={styles.fileName}>{upload.filename}</span>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
              <span className={styles.fileStatus}>
                {upload.status === "uploading" && `${upload.progress}%`}
                {upload.status === "completing" && "Finalizing..."}
                {upload.status === "complete" && "Done"}
                {upload.status === "error" && upload.error}
              </span>
              {(upload.status === "uploading" || upload.status === "completing") && (
                <button
                  type="button"
                  className={styles.fileCancelButton}
                  onClick={() => actions.cancelUpload(upload.id)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
