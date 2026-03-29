import type React from "react";
import type { FeedItem, SubscriptionPlan, Visibility } from "@snc/shared";

import { ContentMeta } from "./content-meta.js";
import { EditableContentMeta } from "./editable-content-meta.js";
import { ThumbnailEditSection } from "./thumbnail-edit-section.js";
import { WrittenLockedPreview } from "./written-locked-preview.js";
import styles from "./written-detail.module.css";

// ── Public Types ──

export interface WrittenDetailEditCallbacks {
  readonly onTitleChange: (value: string) => void;
  readonly onDescriptionChange: (value: string) => void;
  readonly onVisibilityChange: (value: Visibility) => void;
  readonly onBodyChange?: (value: string) => void;
  readonly onThumbnailUpload?: (file: File) => void;
  readonly onThumbnailRemove?: () => void;
}

export interface WrittenDetailProps {
  readonly item: FeedItem;
  readonly locked?: boolean;
  readonly plans?: readonly SubscriptionPlan[];
  readonly isEditing?: boolean;
  readonly editCallbacks?: WrittenDetailEditCallbacks;
  /** When true, skip rendering EditableContentMeta/ContentMeta (metadata handled externally). */
  readonly hideMetadata?: boolean;
}

// ── Public API ──

/** Detail view for written content rendering paragraphs from the body text. Locked mode shows a truncated preview with a subscribe CTA; edit mode provides inline title, description, visibility, thumbnail, and body editing. */
export function WrittenDetail({
  item,
  locked,
  plans,
  isEditing,
  editCallbacks,
  hideMetadata,
}: WrittenDetailProps): React.ReactElement {
  if (locked === true) {
    return <WrittenLockedPreview item={item} plans={plans} />;
  }

  const paragraphs = item.body
    ? item.body.split(/\n\n+/).filter((p) => p.trim().length > 0)
    : [];

  return (
    <div className={styles.writtenDetail}>
      {!hideMetadata && (
        <header className={styles.header}>
          {isEditing && editCallbacks ? (
            <EditableContentMeta
              title={item.title}
              creatorName={item.creatorName}
              publishedAt={item.publishedAt}
              description={item.description}
              visibility={item.visibility}
              isEditing={true}
              onTitleChange={editCallbacks.onTitleChange}
              onDescriptionChange={editCallbacks.onDescriptionChange}
              onVisibilityChange={editCallbacks.onVisibilityChange}
            />
          ) : (
            <ContentMeta
              title={item.title}
              creatorName={item.creatorName}
              publishedAt={item.publishedAt}
            />
          )}
        </header>
      )}
      {isEditing && editCallbacks && (
        <ThumbnailEditSection
          thumbnailSrc={item.thumbnailUrl}
          title={item.title}
          isEditing={true}
          onThumbnailUpload={editCallbacks.onThumbnailUpload}
          onThumbnailRemove={editCallbacks.onThumbnailRemove}
          styles={styles}
        />
      )}
      <hr className={styles.divider} />
      {isEditing && editCallbacks?.onBodyChange ? (
        <>
          <label className={styles.fieldLabel} htmlFor="edit-body">Body</label>
          <textarea
            id="edit-body"
            value={item.body ?? ""}
            onChange={(e) => editCallbacks.onBodyChange!(e.target.value)}
            className={styles.bodyTextarea}
            rows={20}
          />
        </>
      ) : (
        <div className={styles.body}>
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      )}
    </div>
  );
}
