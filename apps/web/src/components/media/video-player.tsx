import "@vidstack/react/player/styles/base.css";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

import { useVidstackModules } from "../../hooks/use-vidstack-modules.js";
import styles from "./video-player.module.css";

// ── Public Types ──

export interface VideoPlayerProps {
  readonly src: string;
  readonly poster?: string;
  readonly mimeType?: string;
}

// ── Public API ──

/** Vidstack-powered video player with dynamic import for SSR safety. */
export function VideoPlayer({ src, poster, mimeType }: VideoPlayerProps) {
  const modules = useVidstackModules();

  if (modules === null) {
    return <div className={styles.skeleton} />;
  }

  const { MediaPlayer, MediaProvider } = modules.core;
  const { DefaultVideoLayout, defaultLayoutIcons } = modules.layouts;

  return (
    <div className={styles.wrapper}>
      <MediaPlayer
        src={mimeType !== undefined ? { src, type: mimeType } : src}
        aspectRatio="16/9"
        crossOrigin=""
        {...(poster !== undefined ? { poster } : {})}
      >
        <MediaProvider />
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
    </div>
  );
}
