import "@vidstack/react/player/styles/base.css";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/audio.css";

import { useVidstackModules } from "../../hooks/use-vidstack-modules.js";
import styles from "./audio-player.module.css";

// ── Public Types ──

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
  const modules = useVidstackModules();

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
