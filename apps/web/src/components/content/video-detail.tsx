import type React from "react";
import type { FeedItem, SubscriptionPlan, Visibility } from "@snc/shared";

import { useFileInput } from "../../hooks/use-file-input.js";
import { VideoPlayer } from "../media/video-player.js";
import { ContentMeta } from "./content-meta.js";
import { EditableContentMeta } from "./editable-content-meta.js";
import { ContentFooter } from "./content-footer.js";
import { ThumbnailEditSection } from "./thumbnail-edit-section.js";
import { useState } from "react";
import { clsx } from "clsx/lite";

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
  readonly plans?: readonly SubscriptionPlan[];
  readonly isEditing?: boolean;
  readonly editCallbacks?: VideoDetailEditCallbacks;
}

// ── Public API ──

/** Detail view for video content with an inline video player, thumbnail, and metadata. Supports locked (subscribe-gated), missing-media, and editing states with media/thumbnail upload controls. */
export function VideoDetail({
  item,
  locked,
  plans,
  isEditing,
  editCallbacks,
}: VideoDetailProps): React.ReactElement {
  const { inputRef: mediaInputRef, triggerSelect: handleMediaClick, handleChange: handleMediaChange } = useFileInput(editCallbacks?.onMediaUpload);
  const [lockedImgBroken, setLockedImgBroken] = useState(false);

  const posterSrc = item.thumbnailUrl;

  if (locked === true) {
    return (
      <div className={styles.videoDetail}>
        <div className={styles.lockedOverlayContainer}>
          {posterSrc && !lockedImgBroken ? (
            <img
              src={posterSrc}
              alt={`Thumbnail for ${item.title}`}
              className={styles.lockedThumbnail}
              onError={() => setLockedImgBroken(true)}
            />
          ) : (
            <div className={styles.lockedThumbnailPlaceholder} />
          )}
          <div className={styles.lockedOverlay}>
            <span className={styles.lockIcon} aria-hidden="true">
              &#x1F512;
            </span>
            <span className={styles.lockedText}>Subscribe to watch</span>
          </div>
        </div>
        <div className={styles.meta}>
          <ContentMeta
            title={item.title}
            creatorName={item.creatorName}
            publishedAt={item.publishedAt}
          />
        </div>
        <ContentFooter
          description={item.description}
          creatorId={item.creatorId}
          contentType="video"
          locked
          plans={plans}
        />
      </div>
    );
  }

  if (item.mediaUrl === null) {
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
      </div>
    );
  }

  const mediaSrc = item.mediaUrl;

  return (
    <div className={styles.videoDetail}>
      <VideoPlayer src={mediaSrc} {...(posterSrc !== null ? { poster: posterSrc } : {})} />
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
    </div>
  );
}
