import type React from "react";
import { useEffect, useRef, useState } from "react";

import "@vidstack/react/player/styles/base.css";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import "@vidstack/react/player/styles/default/layouts/audio.css";

import type { PlayerSrc } from "@vidstack/react";
import type { ChannelListResponse } from "@snc/shared";

import { clsx } from "clsx/lite";

import { useGlobalPlayer } from "../../contexts/global-player-context.js";
import { useVidstackModules } from "../../hooks/use-vidstack-modules.js";
import { apiGet } from "../../lib/fetch-utils.js";

import styles from "./global-player.module.css";

const LIVE_STATUS_POLL_MS = 10_000;
const LIVE_STATUS_MISS_THRESHOLD = 3;

/** Local playback state for the skeleton / error overlay lifecycle. */
type PlayerStatus = "loading" | "ready" | "error";

// ── Public API ──

/** Single persistent media player rendered in the root layout. CSS controls expanded/collapsed/hidden presentation. */
export function GlobalPlayer(): React.ReactElement | null {
  const { state, presentation, actions } = useGlobalPlayer();
  const modules = useVidstackModules();

  // PlayerStatus drives the skeleton and error overlays (non-audio only).
  const [status, setStatus] = useState<PlayerStatus>("loading");
  // Bumping retryKey remounts MediaPlayer without changing the media item.
  const [retryKey, setRetryKey] = useState(0);

  // Set mini player height CSS variable for collapsed modes
  useEffect(() => {
    if (presentation === "collapsed") {
      const height = state.media?.contentType === "audio" ? "64px" : "0px";
      document.body.style.setProperty("--mini-player-height", height);
    } else {
      document.body.style.removeProperty("--mini-player-height");
    }
    return () => {
      document.body.style.removeProperty("--mini-player-height");
    };
  }, [presentation, state.media?.contentType]);

  // Stream-end detection for live creator streams. hls.js retries live
  // manifests indefinitely, so Vidstack never surfaces an error — poll the
  // streaming status endpoint instead. Dismiss only after N consecutive
  // "channel missing" polls so a brief unpublish/republish flap doesn't kick
  // viewers out of the mini-player.
  //
  // Scoped to contentType === "live" (not streamType, which is "live" for
  // playout channels too): playout streams are always-on schedules, not
  // creator-initiated broadcasts, so they don't "end" the same way.
  const mediaId = state.media?.id ?? null;
  const isLiveChannel = state.media?.contentType === "live";
  const missCountRef = useRef(0);
  useEffect(() => {
    if (!isLiveChannel || mediaId === null) return;
    missCountRef.current = 0;
    let cancelled = false;
    const tick = async () => {
      try {
        const status = await apiGet<ChannelListResponse>("/api/streaming/status");
        if (cancelled) return;
        const present = status.channels.some((c) => c.id === mediaId);
        if (present) {
          missCountRef.current = 0;
        } else if (++missCountRef.current >= LIVE_STATUS_MISS_THRESHOLD) {
          actions.clear();
        }
      } catch {
        // Transient failure — keep playing; next tick retries.
      }
    };
    const id = window.setInterval(tick, LIVE_STATUS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [mediaId, isLiveChannel, actions]);

  // Reset to loading whenever the media item changes (channel switch, new content).
  useEffect(() => {
    setStatus("loading");
  }, [mediaId]);

  if (!state.media) return null;

  const { media } = state;
  const isAudio = media.contentType === "audio";
  const isLive = media.streamType === "live";

  const containerClass = (() => {
    if (presentation === "hidden") return styles.hidden;
    if (presentation === "expanded") return styles.expanded;
    if (isAudio) return styles.collapsedBar;
    return styles.collapsedOverlay;
  })();

  return (
    <div
      className={clsx(
        containerClass,
        // pendingFrame only on the expanded container: collapsedOverlay already has
        // aspect-ratio + position:fixed, and pendingFrame's position:relative would
        // override the fixed positioning (rule order) and drop it into document flow.
        presentation === "expanded" && !isAudio && status !== "ready" && styles.pendingFrame,
      )}
      data-presentation={presentation}
    >
      {modules !== null && (() => {
        const { MediaPlayer, MediaProvider } = modules.core;
        const { DefaultVideoLayout, DefaultAudioLayout, defaultLayoutIcons } = modules.layouts;
        return (
          <MediaPlayer
            key={`${media.id}:${retryKey}`}
            src={media.source as PlayerSrc}
            autoPlay={state.shouldAutoPlay || isLive}
            title={media.title}
            artist={media.artist}
            crossOrigin=""
            {...(media.posterUrl !== null && !isAudio ? { poster: media.posterUrl } : {})}
            {...(isLive ? { streamType: "live" as const, muted: true } : {})}
            {...(isAudio ? { viewType: "audio" as const } : { aspectRatio: "16/9" })}
            onCanPlay={() => setStatus("ready")}
            onError={() => setStatus("error")}
          >
            <MediaProvider />
            {isAudio ? (
              <DefaultAudioLayout icons={defaultLayoutIcons} />
            ) : (
              <DefaultVideoLayout
                icons={defaultLayoutIcons}
                {...(isLive ? { slots: { timeSlider: null } } : {})}
              />
            )}
          </MediaPlayer>
        );
      })()}
      {!isAudio && status === "loading" && (
        <div className={styles.playerSkeleton} role="status" aria-label="Loading stream" />
      )}
      {!isAudio && status === "error" && (
        <div className={styles.playerError} role="alert">
          <p className={styles.playerErrorText}>
            The stream couldn&apos;t be loaded. It may have just ended, or the connection hiccuped.
          </p>
          <button
            type="button"
            className={styles.playerErrorRetry}
            onClick={() => {
              setRetryKey((k) => k + 1);
              setStatus("loading");
            }}
          >
            Try again
          </button>
        </div>
      )}
      {presentation === "collapsed" && (
        <div className={styles.collapsedActions}>
          <a
            href={media.contentUrl}
            className={styles.expandButton}
            aria-label="Go to content"
            title="Go to content"
          >
            {"↗"}
          </a>
          <CloseButton onClose={actions.clear} />
        </div>
      )}
    </div>
  );
}

/** Close button for the collapsed player. */
function CloseButton({ onClose }: { readonly onClose: () => void }) {
  return (
    <button
      type="button"
      className={styles.closeButton}
      onClick={onClose}
      aria-label="Close player"
    >
      {"✕"}
    </button>
  );
}
