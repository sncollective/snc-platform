import type React from "react";
import type { SocialPlatform } from "@snc/shared";
import {
  siBandcamp,
  siSpotify,
  siApplemusic,
  siSoundcloud,
  siYoutubemusic,
  siTidal,
  siInstagram,
  siTiktok,
  siX,
  siMastodon,
  siYoutube,
} from "simple-icons";

import styles from "./social-links-section.module.css";

// ── Private Constants ──

const GLOBE_PATH =
  "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 1.5a8.5 8.5 0 0 1 5.97 2.47A12.04 12.04 0 0 0 12 4.5a12.04 12.04 0 0 0-5.97 1.47A8.5 8.5 0 0 1 12 3.5zM3.5 12c0-1.34.31-2.6.86-3.73A10.52 10.52 0 0 1 12 6a10.52 10.52 0 0 1 7.64 2.27c.55 1.13.86 2.39.86 3.73s-.31 2.6-.86 3.73A10.52 10.52 0 0 1 12 18a10.52 10.52 0 0 1-7.64-2.27A8.45 8.45 0 0 1 3.5 12zm8.5 8.5a8.5 8.5 0 0 1-5.97-2.47A12.04 12.04 0 0 0 12 19.5a12.04 12.04 0 0 0 5.97-1.47A8.5 8.5 0 0 1 12 20.5zM12 2v20M2 12h20";

const PLATFORM_ICONS: Record<SocialPlatform, { path: string; hex: string }> = {
  bandcamp: { path: siBandcamp.path, hex: `#${siBandcamp.hex}` },
  spotify: { path: siSpotify.path, hex: `#${siSpotify.hex}` },
  "apple-music": { path: siApplemusic.path, hex: `#${siApplemusic.hex}` },
  soundcloud: { path: siSoundcloud.path, hex: `#${siSoundcloud.hex}` },
  "youtube-music": { path: siYoutubemusic.path, hex: `#${siYoutubemusic.hex}` },
  tidal: { path: siTidal.path, hex: `#${siTidal.hex}` },
  instagram: { path: siInstagram.path, hex: `#${siInstagram.hex}` },
  tiktok: { path: siTiktok.path, hex: `#${siTiktok.hex}` },
  twitter: { path: siX.path, hex: `#${siX.hex}` },
  mastodon: { path: siMastodon.path, hex: `#${siMastodon.hex}` },
  youtube: { path: siYoutube.path, hex: `#${siYoutube.hex}` },
  website: { path: GLOBE_PATH, hex: "#888888" },
};

// ── Public Types ──

export interface PlatformIconProps {
  readonly platform: SocialPlatform;
}

// ── Public API ──

export function PlatformIcon({
  platform,
}: PlatformIconProps): React.ReactElement {
  const icon = PLATFORM_ICONS[platform];
  return (
    <span className={styles.platformIcon} aria-hidden="true">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={icon.hex}
        role="img"
      >
        <path d={icon.path} />
      </svg>
    </span>
  );
}
