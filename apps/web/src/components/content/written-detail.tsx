import { useRef } from "react";
import type React from "react";
import type { FeedItem, SubscriptionPlan, Visibility } from "@snc/shared";

import { truncateToWords } from "../../lib/format.js";
import { ContentMeta } from "./content-meta.js";
import { EditableContentMeta } from "./editable-content-meta.js";
import { SubscribeCta } from "./subscribe-cta.js";
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
}

// ── Private Constants ──

const TRUNCATE_WORD_COUNT = 200;

// ── Public API ──

export function WrittenDetail({
  item,
  locked,
  plans,
  isEditing,
  editCallbacks,
}: WrittenDetailProps): React.ReactElement {
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);

  const handleThumbnailClick = () => {
    thumbnailInputRef.current?.click();
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    editCallbacks?.onThumbnailUpload?.(file);
    e.target.value = "";
  };

  if (locked === true) {
    const previewText = item.body
      ? truncateToWords(item.body, TRUNCATE_WORD_COUNT)
      : "";
    const previewParagraphs = previewText
      .split(/\n\n+/)
      .filter((p) => p.trim().length > 0);

    return (
      <div className={styles.writtenDetail}>
        <header className={styles.header}>
          <ContentMeta
            title={item.title}
            creatorName={item.creatorName}
            publishedAt={item.publishedAt}
          />
        </header>
        <hr className={styles.divider} />
        <div className={styles.bodyPreview}>
          <div className={styles.body}>
            {previewParagraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <div className={styles.fadeOverlay} />
        </div>
        <SubscribeCta creatorId={item.creatorId} contentType="written" plans={plans ?? []} />
      </div>
    );
  }

  const paragraphs = item.body
    ? item.body.split(/\n\n+/).filter((p) => p.trim().length > 0)
    : [];

  return (
    <div className={styles.writtenDetail}>
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
      {isEditing && item.thumbnailUrl !== null && editCallbacks && (
        <div className={styles.editMediaActions}>
          <button type="button" className={styles.replaceButton} onClick={handleThumbnailClick}>
            Replace Thumbnail
          </button>
          <input ref={thumbnailInputRef} type="file" className={styles.hiddenInput} accept="image/*" onChange={handleThumbnailChange} />
          {editCallbacks.onThumbnailRemove && (
            <button type="button" className={styles.removeButton} onClick={editCallbacks.onThumbnailRemove}>
              Remove Thumbnail
            </button>
          )}
        </div>
      )}
      {isEditing && !item.thumbnailUrl && editCallbacks?.onThumbnailUpload && (
        <div className={styles.uploadPlaceholder}>
          <button
            type="button"
            className={styles.uploadPlaceholderButton}
            onClick={handleThumbnailClick}
          >
            Upload Thumbnail
          </button>
          <input
            ref={thumbnailInputRef}
            type="file"
            className={styles.hiddenInput}
            accept="image/*"
            onChange={handleThumbnailChange}
          />
        </div>
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
