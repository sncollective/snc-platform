import type React from "react";
import type { FeedItem, SubscriptionPlan, Visibility } from "@snc/shared";

import { useFileInput } from "../../hooks/use-file-input.js";
import { AudioPlayer } from "../media/audio-player.js";
import { ContentMeta } from "./content-meta.js";
import { EditableContentMeta } from "./editable-content-meta.js";
import { ContentFooter } from "./content-footer.js";
import { ThumbnailEditSection } from "./thumbnail-edit-section.js";
import { AudioLockedView } from "./audio-locked-view.js";

import styles from "./audio-detail.module.css";

// ── Public Types ──

export interface AudioDetailEditCallbacks {
  readonly onTitleChange: (value: string) => void;
  readonly onDescriptionChange: (value: string) => void;
  readonly onVisibilityChange: (value: Visibility) => void;
  readonly onMediaUpload?: (file: File) => void;
  readonly onThumbnailUpload?: (file: File) => void;
  readonly onMediaRemove?: () => void;
  readonly onThumbnailRemove?: () => void;
}

export interface AudioDetailProps {
  readonly item: FeedItem;
  readonly locked?: boolean;
  readonly plans?: readonly SubscriptionPlan[] | undefined;
  readonly isEditing?: boolean;
  readonly editCallbacks?: AudioDetailEditCallbacks;
  /** When true, skip rendering EditableContentMeta/ContentMeta/ContentFooter (metadata handled externally). */
  readonly hideMetadata?: boolean;
}

// ── Public API ──

/** Detail view for audio content showing cover art, metadata, and an inline audio player. Supports locked (subscribe-gated), missing-media, and editing states with media/thumbnail upload controls. */
export function AudioDetail({
  item,
  locked,
  plans,
  isEditing,
  editCallbacks,
  hideMetadata,
}: AudioDetailProps): React.ReactElement {
  const { inputRef: mediaInputRef, triggerSelect: handleMediaClick, handleChange: handleMediaChange } = useFileInput(editCallbacks?.onMediaUpload);

  const coverArtSrc = item.thumbnailUrl;

  if (locked === true) {
    return (
      <div className={styles.audioDetail}>
        <AudioLockedView item={item} plans={plans} />
      </div>
    );
  }

  if (item.mediaUrl === null) {
    return (
      <div className={styles.audioDetail}>
        <div className={styles.header}>
          <ThumbnailEditSection
            thumbnailSrc={coverArtSrc}
            title={item.title}
            isEditing={!!isEditing && !!editCallbacks}
            onThumbnailUpload={editCallbacks?.onThumbnailUpload}
            onThumbnailRemove={editCallbacks?.onThumbnailRemove}
            styles={styles}
            imgSize={{ width: 280, height: 280 }}
          />
          <div className={styles.trackInfo}>
            {!hideMetadata && (isEditing && editCallbacks ? (
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
            ))}
            {isEditing && editCallbacks?.onMediaUpload ? (
              <div className={styles.uploadPlaceholder}>
                <button
                  type="button"
                  className={styles.uploadPlaceholderButton}
                  onClick={handleMediaClick}
                >
                  Upload Audio
                </button>
                <input
                  ref={mediaInputRef}
                  type="file"
                  className={styles.hiddenInput}
                  accept="audio/*"
                  aria-label="Upload audio file"
                  onChange={handleMediaChange}
                />
              </div>
            ) : (
              <p className={styles.mediaUnavailableText}>Media not yet available</p>
            )}
          </div>
        </div>
        {!hideMetadata && <ContentFooter description={isEditing ? null : item.description} />}
      </div>
    );
  }

  const mediaSrc = item.mediaUrl;

  return (
    <div className={styles.audioDetail}>
      <div className={styles.header}>
        <ThumbnailEditSection
          thumbnailSrc={coverArtSrc}
          title={item.title}
          isEditing={!!isEditing && !!editCallbacks}
          onThumbnailUpload={editCallbacks?.onThumbnailUpload}
          onThumbnailRemove={editCallbacks?.onThumbnailRemove}
          styles={styles}
          imgSize={{ width: 280, height: 280 }}
        />
        <div className={styles.trackInfo}>
          {!hideMetadata && (isEditing && editCallbacks ? (
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
          ))}
          <div className={styles.playerWrapper}>
            <AudioPlayer
              src={mediaSrc}
              title={item.title}
              creator={item.creatorName}
              {...(coverArtSrc !== null ? { coverArtUrl: coverArtSrc } : {})}
              contentId={item.id}
            />
          </div>
          {isEditing && editCallbacks && (
            <div className={styles.editMediaActions}>
              <button type="button" className={styles.replaceButton} onClick={handleMediaClick}>
                Replace Audio
              </button>
              <input ref={mediaInputRef} type="file" className={styles.hiddenInput} accept="audio/*" aria-label="Upload audio file" onChange={handleMediaChange} />
              {editCallbacks.onMediaRemove && (
                <button type="button" className={styles.removeButton} onClick={editCallbacks.onMediaRemove}>
                  Remove Audio
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {!hideMetadata && <ContentFooter description={isEditing ? null : item.description} />}
    </div>
  );
}
