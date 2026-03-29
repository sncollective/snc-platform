import type React from "react";
import { useState } from "react";
import type { FeedItem, Visibility } from "@snc/shared";
import { MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH, VISIBILITY } from "@snc/shared";

import { ProcessingIndicator } from "./processing-indicator.js";
import { formatDate } from "../../lib/format.js";

import styles from "./content-settings-sidebar.module.css";

// ── Public Types ──

export interface ContentSettingsSidebarProps {
  /** The content item (with current edit state applied). */
  readonly item: FeedItem;
  /** Whether the form fields are editable. */
  readonly isEditing: boolean;
  /** Metadata change callbacks (from useContentManagement). */
  readonly onTitleChange: (value: string) => void;
  readonly onDescriptionChange: (value: string) => void;
  readonly onVisibilityChange: (value: Visibility) => void;
  /** Publish/unpublish actions. */
  readonly onPublish: () => Promise<void>;
  readonly onUnpublish: () => Promise<void>;
  /** Action states. */
  readonly isPublishing: boolean;
  readonly canPublish: boolean;
}

// ── Private Types ──

interface PublishConfirmationProps {
  readonly visibility: Visibility;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

// ── Private Components ──

function PublishConfirmation({
  visibility,
  onConfirm,
  onCancel,
}: PublishConfirmationProps): React.ReactElement {
  return (
    <div className={styles.publishConfirm}>
      <p className={styles.confirmText}>
        Publish as <strong>{visibility === "public" ? "Public" : "Subscribers Only"}</strong>?
      </p>
      <div className={styles.confirmActions}>
        <button type="button" className={styles.confirmButton} onClick={onConfirm}>
          Confirm
        </button>
        <button type="button" className={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Public API ──

/** Settings sidebar for the content edit page. Renders metadata fields, slug display, media status, and publish controls. */
export function ContentSettingsSidebar({
  item,
  isEditing,
  onTitleChange,
  onDescriptionChange,
  onVisibilityChange,
  onPublish,
  onUnpublish,
  isPublishing,
  canPublish,
}: ContentSettingsSidebarProps): React.ReactElement {
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  return (
    <aside className={styles.sidebar}>
      {/* ── Details Section ── */}
      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Details</h3>

        <label className={styles.fieldLabel} htmlFor="sidebar-title">Title</label>
        <input
          id="sidebar-title"
          type="text"
          value={item.title}
          onChange={(e) => onTitleChange(e.target.value)}
          className={styles.titleInput}
          maxLength={MAX_TITLE_LENGTH}
          readOnly={!isEditing}
        />

        <label className={styles.fieldLabel} htmlFor="sidebar-description">Description</label>
        <textarea
          id="sidebar-description"
          value={item.description ?? ""}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className={styles.descriptionInput}
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder="Add a description..."
          rows={3}
          readOnly={!isEditing}
        />

        {item.slug && (
          <div className={styles.slugDisplay}>
            <span className={styles.slugLabel}>URL</span>
            <span className={styles.slugValue}>/{item.slug}</span>
          </div>
        )}
      </section>

      {/* ── Access Section ── */}
      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Access</h3>

        <label className={styles.fieldLabel} htmlFor="sidebar-visibility">Visibility</label>
        <select
          id="sidebar-visibility"
          value={item.visibility}
          onChange={(e) => {
            const value = e.target.value;
            if ((VISIBILITY as readonly string[]).includes(value)) {
              onVisibilityChange(value as Visibility);
            }
          }}
          className={styles.visibilitySelect}
          disabled={!isEditing}
        >
          <option value="public">Public</option>
          <option value="subscribers">Subscribers Only</option>
        </select>
      </section>

      {/* ── Media Status Section (audio/video only) ── */}
      {item.type !== "written" && (
        <section className={styles.section}>
          <h3 className={styles.sectionHeading}>Media</h3>
          <div className={styles.mediaStatus}>
            {item.mediaUrl ? (
              <span className={styles.mediaReady}>Media uploaded</span>
            ) : (
              <span className={styles.mediaNeeded}>No media uploaded</span>
            )}
          </div>
          {item.processingStatus && item.processingStatus !== "ready" && (
            <ProcessingIndicator status={item.processingStatus} />
          )}
        </section>
      )}

      {/* ── Publish Section ── */}
      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Publish</h3>
        {item.publishedAt ? (
          <>
            <p className={styles.publishedInfo}>
              Published {formatDate(item.publishedAt)}
            </p>
            <button
              type="button"
              className={styles.unpublishButton}
              onClick={() => void onUnpublish()}
              disabled={isPublishing}
            >
              {isPublishing ? "..." : "Revert to Draft"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.publishButton}
              onClick={() => setShowPublishConfirm(true)}
              disabled={!canPublish || isPublishing}
            >
              {isPublishing ? "Publishing..." : "Publish"}
            </button>
            {!canPublish && item.type !== "written" && !item.mediaUrl && (
              <p className={styles.publishHint}>Upload media before publishing</p>
            )}
          </>
        )}
        {showPublishConfirm && (
          <PublishConfirmation
            visibility={item.visibility}
            onConfirm={() => {
              setShowPublishConfirm(false);
              void onPublish();
            }}
            onCancel={() => setShowPublishConfirm(false)}
          />
        )}
      </section>
    </aside>
  );
}
