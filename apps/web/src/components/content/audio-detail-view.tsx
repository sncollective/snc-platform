import type React from "react";
import { useEffect, useState } from "react";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { useGlobalPlayer } from "../../contexts/global-player-context.js";
import type { MediaMetadata } from "../../contexts/global-player-context.js";
import { ContentMeta } from "./content-meta.js";
import { ContentFooter } from "./content-footer.js";

import styles from "./audio-detail-view.module.css";

// ── Public Types ──

export interface AudioDetailViewProps {
  readonly item: FeedItem;
  readonly locked?: boolean;
  readonly plans?: readonly SubscriptionPlan[];
}

// ── Public API ──

/** Consumption-only audio detail. Shows cover art with play overlay and delegates playback to GlobalPlayer. */
export function AudioDetailView({ item, locked, plans }: AudioDetailViewProps): React.ReactElement {
  const { state, presentation, actions } = useGlobalPlayer();
  const [lockedImgBroken, setLockedImgBroken] = useState(false);

  // Signal expanded mode only when this content is actually playing
  useEffect(() => {
    if (state.media?.id === item.id) {
      actions.setActiveDetail(item.id);
    }
    return () => actions.setActiveDetail(null);
  }, [item.id, state.media?.id, actions]);

  const coverArtSrc = item.thumbnailUrl;
  const mediaSrc = item.mediaUrl;
  const isPlaying = state.media?.id === item.id;
  const playerExpanded = isPlaying && presentation === "expanded";

  if (locked === true) {
    return (
      <div className={styles.audioDetail}>
        <div className={styles.header}>
          {coverArtSrc && !lockedImgBroken ? (
            <img
              src={coverArtSrc}
              alt={`Thumbnail for ${item.title}`}
              className={styles.coverArt}
              width={280}
              height={280}
              onError={() => setLockedImgBroken(true)}
            />
          ) : (
            <div className={styles.coverArtPlaceholder} />
          )}
          <div className={styles.trackInfo}>
            <ContentMeta
              title={item.title}
              creatorName={item.creatorName}
              publishedAt={item.publishedAt}
            />
            <p className={styles.lockedText}>Subscribe to listen</p>
          </div>
        </div>
        <ContentFooter
          description={item.description}
          creatorId={item.creatorId}
          contentType="audio"
          locked
          plans={plans}
        />
      </div>
    );
  }

  if (!mediaSrc) {
    return (
      <div className={styles.audioDetail}>
        <div className={styles.header}>
          {coverArtSrc ? (
            <img
              src={coverArtSrc}
              alt={`Thumbnail for ${item.title}`}
              className={styles.coverArt}
              width={280}
              height={280}
            />
          ) : (
            <div className={styles.coverArtPlaceholder} />
          )}
          <div className={styles.trackInfo}>
            <ContentMeta
              title={item.title}
              creatorName={item.creatorName}
              publishedAt={item.publishedAt}
            />
            <p className={styles.mediaUnavailableText}>Media not yet available</p>
          </div>
        </div>
        <ContentFooter description={item.description} />
      </div>
    );
  }

  const contentUrl = typeof window !== "undefined" ? window.location.pathname : "";
  const audioMetadata: MediaMetadata = {
    id: item.id,
    contentType: "audio",
    title: item.title,
    artist: item.creatorName,
    posterUrl: item.thumbnailUrl,
    source: { src: mediaSrc, type: "audio/mpeg" },
    streamType: "on-demand",
    contentUrl,
  };

  return (
    <div className={styles.audioDetail}>
      <div className={styles.header}>
        {!playerExpanded ? (
          <div
            className={styles.coverArtWrapper}
            onClick={() => actions.play(audioMetadata)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") actions.play(audioMetadata);
            }}
            aria-label="Play audio"
          >
            {coverArtSrc ? (
              <img
                src={coverArtSrc}
                alt=""
                className={styles.coverArt}
                width={280}
                height={280}
              />
            ) : (
              <div className={styles.coverArtPlaceholder} />
            )}
            <div className={styles.playOverlayIcon}>
              <div className={styles.playIcon}>{"\u25B6"}</div>
            </div>
          </div>
        ) : (
          <div className={styles.coverArtWrapper}>
            {coverArtSrc ? (
              <img
                src={coverArtSrc}
                alt=""
                className={styles.coverArt}
                width={280}
                height={280}
              />
            ) : (
              <div className={styles.coverArtPlaceholder} />
            )}
          </div>
        )}
        <div className={styles.trackInfo}>
          <ContentMeta
            title={item.title}
            creatorName={item.creatorName}
            publishedAt={item.publishedAt}
          />
          {!playerExpanded && (
            <button
              type="button"
              className={styles.playButton}
              onClick={() => actions.play(audioMetadata)}
            >
              Play
            </button>
          )}
        </div>
      </div>
      <ContentFooter description={item.description} />
    </div>
  );
}
