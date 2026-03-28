import type React from "react";
import { useEffect } from "react";
import type { FeedItem } from "@snc/shared";

import { useContentManagement } from "../../hooks/use-content-management.js";
import { VideoDetail } from "./video-detail.js";
import { AudioDetail } from "./audio-detail.js";
import { WrittenDetail } from "./written-detail.js";

import styles from "./content-editor.module.css";

// ── Public Types ──

export interface ContentEditorProps {
  readonly item: FeedItem;
}

// ── Public API ──

/** Full content editor for creator management pages. Provides edit, publish/unpublish, delete controls with inline media management. */
export function ContentEditor({ item }: ContentEditorProps): React.ReactElement {
  const mgmt = useContentManagement(item, true);

  // Start editing immediately on mount
  useEffect(() => {
    mgmt.startEditing();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.editor}>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.saveButton}
          onClick={() => void mgmt.save()}
          disabled={mgmt.isSaving}
        >
          {mgmt.isSaving ? "Saving..." : "Save"}
        </button>

        {item.publishedAt ? (
          <button
            type="button"
            className={styles.unpublishButton}
            onClick={() => void mgmt.unpublish()}
            disabled={mgmt.isPublishing}
          >
            {mgmt.isPublishing ? "..." : "Unpublish"}
          </button>
        ) : (
          <button
            type="button"
            className={styles.publishButton}
            onClick={() => void mgmt.publish()}
            disabled={mgmt.isPublishing || (item.type !== "written" && !item.mediaUrl)}
          >
            {mgmt.isPublishing ? "..." : "Publish"}
          </button>
        )}

        <button
          type="button"
          className={styles.deleteButton}
          onClick={() => void mgmt.remove()}
          disabled={mgmt.isDeleting}
        >
          {mgmt.isDeleting ? "Deleting..." : "Delete"}
        </button>

        {mgmt.error && (
          <span className={styles.actionError} role="alert">
            {mgmt.error}
          </span>
        )}
      </div>

      {item.type === "video" && (
        <VideoDetail
          item={mgmt.editingItem}
          isEditing={mgmt.isEditing}
          {...(mgmt.editCallbacks ? { editCallbacks: mgmt.editCallbacks } : {})}
        />
      )}
      {item.type === "audio" && (
        <AudioDetail
          item={mgmt.editingItem}
          isEditing={mgmt.isEditing}
          {...(mgmt.editCallbacks ? { editCallbacks: mgmt.editCallbacks } : {})}
        />
      )}
      {item.type === "written" && (
        <WrittenDetail
          item={mgmt.editingItem}
          isEditing={mgmt.isEditing}
          {...(mgmt.editCallbacks ? { editCallbacks: mgmt.editCallbacks } : {})}
        />
      )}
    </div>
  );
}
