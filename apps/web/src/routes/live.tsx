import { createFileRoute, redirect } from "@tanstack/react-router";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Channel, ChannelListResponse } from "@snc/shared";

import { RouteErrorBoundary } from "../components/error/route-error-boundary.js";
import { useGlobalPlayer } from "../contexts/global-player-context.js";
import type { MediaMetadata } from "../contexts/global-player-context.js";
import { ChatPanel } from "../components/chat/chat-panel.js";
import { fetchApiServer } from "../lib/api-server.js";
import { isFeatureEnabled } from "../lib/config.js";
import { apiGet } from "../lib/fetch-utils.js";
import { ChatProvider } from "../contexts/chat-context.js";

import styles from "./live.module.css";

// ── Constants ──

const POLL_INTERVAL_MS = 15_000;

// ── Route ──

export const Route = createFileRoute("/live")({
  errorComponent: RouteErrorBoundary,
  loader: async (): Promise<{ initial: ChannelListResponse | null }> => {
    if (!isFeatureEnabled("streaming")) throw redirect({ to: "/" });
    try {
      const initial = (await fetchApiServer({
        data: "/api/streaming/status",
      })) as ChannelListResponse;
      return { initial };
    } catch {
      return { initial: null };
    }
  },
  head: () => ({
    meta: [
      { title: "Live — S/NC" },
      { name: "description", content: "Watch live streams from S/NC creators." },
      { property: "og:title", content: "Live — S/NC" },
      { property: "og:description", content: "Watch live streams from S/NC creators." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://snc.coop/live" }],
  }),
  component: LivePage,
});

// ── Polling Hook ──

/** Poll the channel list endpoint on a fixed interval. */
function useChannelList(
  initial: ChannelListResponse | null,
): ChannelListResponse | null {
  const [data, setData] = useState<ChannelListResponse | null>(initial);
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const next = await apiGet<ChannelListResponse>("/api/streaming/status");
      if (mountedRef.current) setData(next);
    } catch {
      // Transient failure — keep showing the last known channel list
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timeoutId = setTimeout(async () => {
        await poll();
        if (mountedRef.current) schedule();
      }, POLL_INTERVAL_MS);
    };

    schedule();

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [poll]);

  return data;
}

// ── Components ──

/** Main live stream page. */
function LivePage(): React.ReactElement {
  const { initial } = Route.useLoaderData();
  const channelList = useChannelList(initial);
  const { actions } = useGlobalPlayer();

  const channels = channelList?.channels ?? [];
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null,
  );

  // Auto-select default channel on first load only
  useEffect(() => {
    if (!selectedChannelId && channelList?.defaultChannelId) {
      setSelectedChannelId(channelList.defaultChannelId);
    }
  }, [channelList?.defaultChannelId, selectedChannelId]);

  const selectedChannel =
    channels.find((c) => c.id === selectedChannelId) ?? null;
  const hasChannels = channels.length > 0;

  // Signal expanded mode while /live is mounted with a selected channel
  useEffect(() => {
    if (selectedChannel) {
      actions.setActiveDetail(selectedChannel.id);
    }
    return () => actions.setActiveDetail(null);
  }, [selectedChannel?.id, actions]);

  // Auto-play the selected channel (live streams auto-play muted per browser policy)
  useEffect(() => {
    if (selectedChannel?.hlsUrl) {
      const metadata: MediaMetadata = {
        id: selectedChannel.id,
        contentType: selectedChannel.type === "live" ? "live" : "playout",
        title: selectedChannel.name,
        artist: selectedChannel.creator?.displayName ?? "S/NC",
        posterUrl: selectedChannel.thumbnailUrl ?? null,
        source: { src: selectedChannel.hlsUrl, type: "application/x-mpegurl" },
        streamType: "live",
        contentUrl: "/live",
      };
      actions.play(metadata);
    }
  }, [selectedChannel?.id, actions]);

  return (
    <ChatProvider>
      <div className={styles.page}>
        <div className={styles.mainContent}>
          {!selectedChannel?.hlsUrl && <ComingSoonPlaceholder />}

          {hasChannels && (
            <div className={styles.streamInfo}>
              <ChannelSelector
                channels={channels}
                selectedId={selectedChannelId}
                onSelect={setSelectedChannelId}
              />
              {selectedChannel && (
                <StreamStatusBar
                  viewerCount={selectedChannel.viewerCount}
                  isLive={selectedChannel.type === "live"}
                />
              )}
            </div>
          )}

          {selectedChannel?.type === "playout" &&
            selectedChannel.nowPlaying != null && (
              <div className={styles.nowPlaying}>
                <span className={styles.nowPlayingLabel}>Now Playing</span>
                <span className={styles.nowPlayingTitle}>
                  {selectedChannel.nowPlaying.title}
                  {selectedChannel.nowPlaying.year !== null &&
                    ` (${selectedChannel.nowPlaying.year})`}
                </span>
                {selectedChannel.nowPlaying.director !== null && (
                  <span className={styles.nowPlayingDirector}>
                    dir. {selectedChannel.nowPlaying.director}
                  </span>
                )}
              </div>
            )}

          {selectedChannel?.creator && (
            <StreamCreatorBar creator={selectedChannel.creator} />
          )}
        </div>

        <div className={styles.chatSidebar}>
          <ChatPanel channelId={selectedChannelId} />
        </div>
      </div>
    </ChatProvider>
  );
}

/** Dropdown for selecting between active channels. */
function ChannelSelector({
  channels,
  selectedId,
  onSelect,
}: {
  readonly channels: readonly Channel[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}): React.ReactElement {
  return (
    <select
      className={styles.channelSelector}
      value={selectedId ?? ""}
      onChange={(e) => onSelect(e.target.value)}
      aria-label="Select channel"
    >
      {channels.map((ch) => (
        <option key={ch.id} value={ch.id}>
          {ch.name} ({ch.viewerCount}{" "}
          {ch.viewerCount === 1 ? "viewer" : "viewers"})
        </option>
      ))}
    </select>
  );
}

/** Creator identity bar: avatar + display name. */
function StreamCreatorBar({
  creator,
}: {
  readonly creator: NonNullable<Channel["creator"]>;
}): React.ReactElement {
  return (
    <div className={styles.creatorBar}>
      {creator.avatarUrl && (
        <img
          src={creator.avatarUrl}
          alt=""
          className={styles.creatorAvatar}
          width={32}
          height={32}
        />
      )}
      <span className={styles.creatorName}>{creator.displayName}</span>
    </div>
  );
}

/** Live status bar showing viewer count and optional live indicator. */
function StreamStatusBar({
  viewerCount,
  isLive,
}: {
  readonly viewerCount: number;
  readonly isLive: boolean;
}): React.ReactElement {
  const viewerLabel = viewerCount === 1 ? "viewer" : "viewers";

  return (
    <div className={styles.statusBar}>
      {isLive && (
        <div className={styles.liveIndicator}>
          <span className={styles.liveDot} aria-hidden="true" />
          LIVE
        </div>
      )}
      <span className={styles.viewerCount}>
        {viewerCount} {viewerLabel}
      </span>
    </div>
  );
}

/** Placeholder shown when no channels are active. */
function ComingSoonPlaceholder(): React.ReactElement {
  return (
    <div className={styles.comingSoon}>
      <h1 className={styles.comingSoonHeading}>Coming Soon</h1>
      <p className={styles.comingSoonText}>
        Live streaming is on its way. Stay tuned.
      </p>
    </div>
  );
}
