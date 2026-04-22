import type React from "react";
import { clsx } from "clsx/lite";

import type { FeedItem, SubscriptionPlan, Visibility } from "@snc/shared";

import { useFileInput } from "../../hooks/use-file-input.js";
import { useContentDisplayState } from "../../hooks/use-content-display-state.js";
import { VideoPlayer } from "../media/video-player.js";
import { ContentMeta } from "./content-meta.js";
import { EditableContentMeta } from "./editable-content-meta.js";
import { ContentFooter } from "./content-footer.js";
import { ThumbnailEditSection } from "./thumbnail-edit-section.js";
import { VideoLockedView } from "./video-locked-view.js";
import { InlineUploadProgress } from "./inline-upload-progress.js";
import { ProcessingIndicator } from "./processing-indicator.js";

import styles from "./video-detail.module.css";

// ── Public Types ──

export interface VideoDetailEditCallbacks {
  readonly onTitleChange: (value: string) => void;
  readonly onDescriptionChange: (value: string) => void;
  readonly onVisibilityChange: (value: Visibility) => void;
  readonly onMediaUpload?: (file: File) => void;
  readonly onThumbnailUpload?: (file: File) => void;
  readonly onMediaRemove?: () => void;
  readonly onThumbnailRemove?: () => void;
}

export interface VideoDetailProps {
  readonly item: FeedItem;
  readonly locked?: boolean;
  readonly plans?: readonly SubscriptionPlan[] | undefined;
  readonly isEditing?: boolean;
  readonly editCallbacks?: VideoDetailEditCallbacks;
  /** When true, skip rendering EditableContentMeta/ContentMeta/ContentFooter (metadata handled externally). */
  readonly hideMetadata?: boolean;
}

// ── Private Helpers ──

function MetaSection({
  item,
  isEditing,
  editCallbacks,
  hideMetadata,
}: {
  item: FeedItem;
  isEditing?: boolean;
  editCallbacks?: VideoDetailEditCallbacks;
  hideMetadata?: boolean;
}): React.ReactElement | null {
  if (hideMetadata) return null;
  return (
    <>
      <div className={styles.meta}>
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
      </div>
      <ContentFooter description={isEditing ? null : item.description} />
    </>
  );
}

// ── Public API ──

/** Detail view for video content with an inline video player, thumbnail, and metadata. Supports locked (subscribe-gated), uploading, processing, ready, failed, and no-media states with media/thumbnail upload controls. */
export function VideoDetail({
  item,
  locked,
  plans,
  isEditing,
  editCallbacks,
  hideMetadata,
}: VideoDetailProps): React.ReactElement {
  const { inputRef: mediaInputRef, triggerSelect: handleMediaClick, handleChange: handleMediaChange } = useFileInput(editCallbacks?.onMediaUpload);
  const posterSrc = item.thumbnailUrl;
  const displayState = useContentDisplayState(item);

  if (locked === true) {
    return (
      <div className={styles.videoDetail}>
        <VideoLockedView item={item} plans={plans} />
      </div>
    );
  }

  switch (displayState.phase) {
    case "uploading":
      return (
        <div className={styles.videoDetail}>
          <InlineUploadProgress upload={displayState.upload} variant="video" />
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
          <MetaSection item={item} isEditing={isEditing} editCallbacks={editCallbacks} hideMetadata={hideMetadata} />
        </div>
      );

    case "processing":
      return (
        <div className={styles.videoDetail}>
          <div className={styles.mediaUnavailable}>
            <ProcessingIndicator status={displayState.status} />
          </div>
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
          <MetaSection item={item} isEditing={isEditing} editCallbacks={editCallbacks} hideMetadata={hideMetadata} />
        </div>
      );

    case "failed":
      return (
        <div className={styles.videoDetail}>
          <div className={styles.mediaUnavailable}>
            <p className={styles.mediaUnavailableText}>Media processing failed</p>
          </div>
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
          <MetaSection item={item} isEditing={isEditing} editCallbacks={editCallbacks} hideMetadata={hideMetadata} />
        </div>
      );

    case "no-media":
      return (
        <div className={styles.videoDetail}>
          {isEditing && editCallbacks?.onMediaUpload ? (
            <div className={clsx(styles.uploadPlaceholder, styles.uploadPlaceholderVideo)}>
              <button
                type="button"
                className={styles.uploadPlaceholderButton}
                onClick={handleMediaClick}
              >
                Upload Video
              </button>
              <input
                ref={mediaInputRef}
                type="file"
                className={styles.hiddenInput}
                accept="video/*"
                aria-label="Upload video file"
                onChange={handleMediaChange}
              />
            </div>
          ) : (
            <div className={styles.mediaUnavailable}>
              <p className={styles.mediaUnavailableText}>Media not yet available</p>
            </div>
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
          <MetaSection item={item} isEditing={isEditing} editCallbacks={editCallbacks} hideMetadata={hideMetadata} />
        </div>
      );

    case "ready": {
      const mediaSrc = item.mediaUrl!;
      return (
        <div className={styles.videoDetail}>
          <VideoPlayer src={mediaSrc} mimeType="video/mp4" {...(posterSrc !== null ? { poster: posterSrc } : {})} />
          {isEditing && editCallbacks && (
            <div className={styles.editMediaActions}>
              <button type="button" className={styles.replaceButton} onClick={handleMediaClick}>
                Replace Video
              </button>
              <input ref={mediaInputRef} type="file" className={styles.hiddenInput} accept="video/*" aria-label="Upload video file" onChange={handleMediaChange} />
              {editCallbacks.onMediaRemove && (
                <button type="button" className={styles.removeButton} onClick={editCallbacks.onMediaRemove}>
                  Remove Video
                </button>
              )}
            </div>
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
          <MetaSection item={item} isEditing={isEditing} editCallbacks={editCallbacks} hideMetadata={hideMetadata} />
        </div>
      );
    }
  }
}
