import { useEffect, useState } from "react";

import "@vidstack/react/player/styles/base.css";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import "@vidstack/react/player/styles/default/layouts/audio.css";

import { useGlobalPlayer } from "../../contexts/global-player-context.js";

import styles from "./global-player.module.css";

// ── Types ──

interface VidstackModules {
  readonly core: typeof import("@vidstack/react");
  readonly layouts: typeof import("@vidstack/react/player/layouts/default");
}

// ── Public API ──

/** Single persistent media player rendered in the root layout. CSS controls expanded/collapsed/hidden presentation. */
export function GlobalPlayer() {
  const { state, presentation, actions } = useGlobalPlayer();
  const [modules, setModules] = useState<VidstackModules | null>(null);

  // Single dynamic import for the app's lifetime
  useEffect(() => {
    Promise.all([
      import("@vidstack/react"),
      import("@vidstack/react/player/layouts/default"),
    ])
      .then(([core, layouts]) => {
        setModules({ core, layouts });
      })
      .catch(() => {
        // Player won't render
      });
  }, []);

  // Set mini player height CSS variable and body padding for collapsed modes
  useEffect(() => {
    if (presentation === "collapsed") {
      const height = state.media?.contentType === "audio" ? "64px" : "0px";
      document.body.style.setProperty("--mini-player-height", height);
      if (state.media?.contentType === "audio") {
        document.body.style.paddingBottom = "64px";
      } else {
        document.body.style.paddingBottom = "";
      }
    } else {
      document.body.style.removeProperty("--mini-player-height");
      document.body.style.paddingBottom = "";
    }
    return () => {
      document.body.style.removeProperty("--mini-player-height");
      document.body.style.paddingBottom = "";
    };
  }, [presentation, state.media?.contentType]);

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
    <div className={containerClass} data-presentation={presentation}>
      {modules !== null && (() => {
        const { MediaPlayer, MediaProvider } = modules.core;
        const { DefaultVideoLayout, DefaultAudioLayout, defaultLayoutIcons } = modules.layouts;
        return (
          <MediaPlayer
            key={media.id}
            src={media.source}
            autoPlay={state.shouldAutoPlay || isLive}
            title={media.title}
            artist={media.artist}
            crossOrigin=""
            {...(media.posterUrl !== null && !isAudio ? { poster: media.posterUrl } : {})}
            {...(isLive ? { streamType: "live" as const, muted: true } : {})}
            {...(isAudio ? { viewType: "audio" as const } : { aspectRatio: "16/9" })}
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
      {presentation === "collapsed" && (
        <div className={styles.collapsedActions}>
          <a
            href={media.contentUrl}
            className={styles.expandButton}
            aria-label="Go to content"
            title="Go to content"
          >
            {"\u2197"}
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
      {"\u2715"}
    </button>
  );
}
