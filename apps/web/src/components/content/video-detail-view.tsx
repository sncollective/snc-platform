import type React from "react";
import { useEffect } from "react";
import type { FeedItem, SubscriptionPlan } from "@snc/shared";

import { useGlobalPlayer } from "../../contexts/global-player-context.js";
import type { MediaMetadata } from "../../contexts/global-player-context.js";
import { ContentMeta } from "./content-meta.js";
import { ContentFooter } from "./content-footer.js";
import { VideoLockedView } from "./video-locked-view.js";

import styles from "./video-detail-view.module.css";

// ── Public Types ──

export interface VideoDetailViewProps {
  readonly item: FeedItem;
  readonly locked?: boolean;
  readonly plans?: readonly SubscriptionPlan[] | undefined;
}

// ── Public API ──

/** Consumption-only video detail. Delegates playback to GlobalPlayer. */
export function VideoDetailView({ item, locked, plans }: VideoDetailViewProps): React.ReactElement {
  const { state, presentation, actions } = useGlobalPlayer();
  // Signal expanded mode only when this content is actually playing
  useEffect(() => {
    if (state.media?.id === item.id) {
      actions.setActiveDetail(item.id);
    }
    return () => actions.setActiveDetail(null);
  }, [item.id, state.media?.id, actions]);

  const posterSrc = item.thumbnail?.src ?? item.thumbnailUrl;
  const mediaSrc = item.mediaUrl;
  // Hide overlay only when the GlobalPlayer is actually expanded and rendering
  const playerExpanded = state.media?.id === item.id && presentation === "expanded";

  if (locked === true) {
    return (
      <div className={styles.videoDetail}>
        <VideoLockedView item={item} plans={plans} />
      </div>
    );
  }

  if (!mediaSrc) {
    return (
      <div className={styles.videoDetail}>
        <div className={styles.mediaUnavailable}>
          <p className={styles.mediaUnavailableText}>Media not yet available</p>
        </div>
        <ContentMeta
          title={item.title}
          creatorName={item.creatorName}
          publishedAt={item.publishedAt}
        />
        <ContentFooter description={item.description} />
      </div>
    );
  }

  const contentUrl = typeof window !== "undefined" ? window.location.pathname : "";
  const videoMetadata: MediaMetadata = {
    id: item.id,
    contentType: "video",
    title: item.title,
    artist: item.creatorName,
    posterUrl: item.thumbnail?.src ?? item.thumbnailUrl,
    source: { src: mediaSrc, type: "video/mp4" },
    streamType: "on-demand",
    contentUrl,
  };

  return (
    <div className={styles.videoDetail}>
      {!playerExpanded && (
        <button
          type="button"
          className={styles.playOverlay}
          onClick={() => actions.play(videoMetadata)}
          aria-label="Play video"
        >
          {posterSrc && (
            <img
              src={posterSrc}
              alt=""
              className={styles.poster}
              width={640}
              height={360}
              {...(item.thumbnail?.srcSet ? { srcSet: item.thumbnail.srcSet } : {})}
              sizes="(max-width: 768px) 100vw, 640px"
            />
          )}
          <div className={styles.playIcon}>{"\u25B6"}</div>
        </button>
      )}
      <ContentMeta
        title={item.title}
        creatorName={item.creatorName}
        publishedAt={item.publishedAt}
      />
      <ContentFooter description={item.description} />
    </div>
  );
}
