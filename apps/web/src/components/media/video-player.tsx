import { useEffect, useState } from "react";

import "@vidstack/react/player/styles/base.css";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

import styles from "./video-player.module.css";

// ── Types ──

interface VidstackModules {
  readonly core: typeof import("@vidstack/react");
  readonly layouts: typeof import("@vidstack/react/player/layouts/default");
}

export interface VideoPlayerProps {
  readonly src: string;
  readonly poster?: string;
  readonly mimeType?: string;
}

// ── Public API ──

/** Vidstack-powered video player with dynamic import for SSR safety. */
export function VideoPlayer({ src, poster, mimeType }: VideoPlayerProps) {
  const [modules, setModules] = useState<VidstackModules | null>(null);

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
