import type React from "react";

import { MAX_TITLE_LENGTH, VISIBILITY } from "@snc/shared";
import type { Visibility } from "@snc/shared";

import { formatDate } from "../../lib/format.js";
import { ContentMeta } from "./content-meta.js";
import metaStyles from "./content-meta.module.css";
import styles from "./editable-content-meta.module.css";

// ── Public Types ──

export interface EditableContentMetaProps {
  readonly title: string;
  readonly creatorName: string;
  readonly publishedAt: string | null;
  readonly description: string | null;
  readonly visibility: Visibility;
  readonly isEditing: boolean;
  readonly onTitleChange: (value: string) => void;
  readonly onDescriptionChange: (value: string) => void;
  readonly onVisibilityChange: (value: Visibility) => void;
}

// ── Public API ──

/** Render content metadata (title, creator, date, description, visibility) as either inline edit fields or read-only text based on the editing state. */
export function EditableContentMeta({
  title,
  creatorName,
  publishedAt,
  description,
  visibility,
  isEditing,
  onTitleChange,
  onDescriptionChange,
  onVisibilityChange,
}: EditableContentMetaProps): React.ReactElement {
  if (isEditing) {
    return (
      <div className={styles.editableMeta}>
        <label className={styles.fieldLabel} htmlFor="edit-title">Title</label>
        <input
          id="edit-title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className={styles.titleInput}
          maxLength={MAX_TITLE_LENGTH}
        />
        <p className={metaStyles.creator}>
          {creatorName}
          {publishedAt && (
            <>
              <span className={metaStyles.separator}> · </span>
              <time dateTime={publishedAt}>{formatDate(publishedAt)}</time>
            </>
          )}
        </p>
        <label className={styles.fieldLabel} htmlFor="edit-description">Description</label>
        <textarea
          id="edit-description"
          value={description ?? ""}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className={styles.descriptionInput}
          placeholder="Add a description..."
          rows={2}
        />
        <label className={styles.fieldLabel} htmlFor="edit-visibility">Visibility</label>
        <select
          id="edit-visibility"
          value={visibility}
          onChange={(e) => {
            const value = e.target.value;
            if ((VISIBILITY as readonly string[]).includes(value)) {
              onVisibilityChange(value as Visibility);
            }
          }}
          className={styles.visibilitySelect}
        >
          <option value="public">Public</option>
          <option value="subscribers">Subscribers Only</option>
        </select>
      </div>
    );
  }

  return (
    <>
      <ContentMeta title={title} creatorName={creatorName} publishedAt={publishedAt} />
      {description && <p className={styles.description}>{description}</p>}
    </>
  );
}
