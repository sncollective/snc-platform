import type React from "react";
import { Link } from "@tanstack/react-router";
import type { Channel } from "@snc/shared";

import styles from "./channel-card.module.css";

export interface ChannelCardProps {
  readonly channel: Channel;
}

/** Render a single streaming channel as a mini "TV screen" card. */
export function ChannelCard({ channel }: ChannelCardProps): React.ReactElement {
  // TODO(live-state): replace identity proxy with derived airing-state.
  // Interim: a creator-owned live-ingest channel stands in for "is live" until
  // live-experience-redesign-live-state lands the real on-air derivation.
  const isLive = channel.ownership === "creator" && channel.role === "live-ingest";
  const nowPlayingText = channel.nowPlaying?.title ?? null;
  const creatorName = channel.creator?.displayName ?? null;

  return (
    <Link
      to="/live"
      search={{ channel: channel.id }}
      className={isLive ? styles.cardLive : styles.card}
    >
      <div className={styles.header}>
        {isLive ? (
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} />
            LIVE
          </span>
        ) : (
          <span className={styles.nowPlayingBadge}>NOW PLAYING</span>
        )}
        {isLive && channel.viewerCount > 0 && (
          <span className={styles.viewerCount}>
            {channel.viewerCount} watching
          </span>
        )}
      </div>
      <div className={styles.info}>
        <span className={styles.channelName}>{channel.name}</span>
        {isLive && creatorName && (
          <span className={styles.creatorName}>{creatorName}</span>
        )}
        {!isLive && nowPlayingText && (
          <span className={styles.trackTitle}>{nowPlayingText}</span>
        )}
      </div>
    </Link>
  );
}
