import { useEffect, useState } from "react";

import "@vidstack/react/player/styles/base.css";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/audio.css";

import styles from "./audio-player.module.css";

// ── Types ──

interface VidstackAudioModules {
  readonly core: typeof import("@vidstack/react");
  readonly layouts: typeof import("@vidstack/react/player/layouts/default");
}

export interface AudioPlayerProps {
  readonly src: string;
  readonly title: string;
  readonly creator: string;
  readonly coverArtUrl?: string;
  readonly contentId: string;
}

// ── Public API ──

/** Inline audio player for content detail pages. */
export function AudioPlayer({
  src,
  title,
  creator,
  coverArtUrl,
}: AudioPlayerProps) {
  const [modules, setModules] = useState<VidstackAudioModules | null>(null);

  // Load vidstack modules once
  useEffect(() => {
    Promise.all([
      import("@vidstack/react"),
      import("@vidstack/react/player/layouts/default"),
    ])
      .then(([core, layouts]) => {
        setModules({ core, layouts });
      })
      .catch(() => {
        // Skeleton remains visible on import failure
      });
  }, []);

  if (modules === null) {
    return <div className={styles.skeleton} />;
  }

  const { MediaPlayer, MediaProvider } = modules.core;
  const { DefaultAudioLayout, defaultLayoutIcons } = modules.layouts;

  return (
    <div className={styles.player}>
      <MediaPlayer
        src={{ src, type: "audio/mpeg" }}
        viewType="audio"
        title={title}
        artist={creator}
        {...(coverArtUrl !== undefined ? { poster: coverArtUrl } : {})}
      >
        <MediaProvider />
        <DefaultAudioLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
    </div>
  );
}
