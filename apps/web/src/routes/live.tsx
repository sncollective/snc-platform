import { createFileRoute, redirect } from "@tanstack/react-router";
import { clsx } from "clsx/lite";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Channel, ChannelListResponse } from "@snc/shared";

import { RouteErrorBoundary } from "../components/error/route-error-boundary.js";
import { useGlobalPlayer } from "../contexts/global-player-context.js";
import type { LiveLayout, MediaMetadata } from "../contexts/global-player-context.js";
import { ChatPanel } from "../components/chat/chat-panel.js";
import { fetchApiServer } from "../lib/api-server.js";
import { isFeatureEnabled } from "../lib/config.js";
import { apiGet } from "../lib/fetch-utils.js";
import { ChatProvider } from "../contexts/chat-context.js";

import styles from "./live.module.css";

// ── Constants ──

const POLL_INTERVAL_MS = 15_000;
const LAYOUT_KEY = "snc-live-layout";

// ── Layout Persistence ──

interface LayoutPrefs {
  readonly theater: boolean;
  readonly chatCollapsed: boolean;
}

const DEFAULT_PREFS: LayoutPrefs = { theater: false, chatCollapsed: false };

function getInitialPrefs(): LayoutPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const stored = JSON.parse(
      localStorage.getItem(LAYOUT_KEY) ?? "{}",
    ) as Record<string, unknown>;
    return {
      theater: stored.theater === true,
      chatCollapsed: stored.chatCollapsed === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function persistPrefs(prefs: LayoutPrefs): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or unavailable — non-critical
  }
}

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
  head: ({ loaderData }) => {
    const firstHlsUrl = loaderData?.initial?.channels[0]?.hlsUrl ?? null;
    const dnsPrefetchLinks =
      firstHlsUrl !== null
        ? [{ rel: "dns-prefetch", href: new URL(firstHlsUrl).origin }]
        : [];
    return {
      meta: [
        { title: "Live — S/NC" },
        { name: "description", content: "Watch live streams from S/NC creators." },
        { property: "og:title", content: "Live — S/NC" },
        { property: "og:description", content: "Watch live streams from S/NC creators." },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: "https://snc.coop/live" }, ...dnsPrefetchLinks],
    };
  },
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
  const { actions, chatPortalRef } = useGlobalPlayer();

  const channels = channelList?.channels ?? [];
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<LayoutPrefs>(getInitialPrefs);

  // Derive layout signal from prefs
  const liveLayout: LiveLayout = prefs.theater ? "theater" : "default";

  // Update prefs with persistence
  const updatePrefs = useCallback((patch: Partial<LayoutPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      persistPrefs(next);
      return next;
    });
  }, []);

  // ── Layout signal: tell root layout to switch to grid ──
  useEffect(() => {
    actions.setLiveLayout(liveLayout);
    return () => actions.setLiveLayout(null);
  }, [liveLayout, actions]);

  // ── Chat collapse signal: tell root layout to collapse chat column ──
  useEffect(() => {
    actions.setChatCollapsed(prefs.chatCollapsed);
    return () => actions.setChatCollapsed(false);
  }, [prefs.chatCollapsed, actions]);

  // ── Keyboard shortcut: 't' for theater ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "t" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        updatePrefs({ theater: !prefs.theater });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prefs.theater, updatePrefs]);

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

  // ── Portal target ──
  const portalTarget = chatPortalRef.current;

  return (
    <ChatProvider>
      {/* Theater toggle — top-right of content area */}
      <button
        type="button"
        className={clsx(
          styles.theaterToggle,
          prefs.theater && styles.theaterToggleActive,
          prefs.chatCollapsed && styles.theaterToggleCollapsed,
        )}
        onClick={() => updatePrefs({ theater: !prefs.theater })}
        aria-label="Theater mode"
        aria-pressed={prefs.theater}
        title="Theater mode (t)"
      >
        {prefs.theater ? "\u2715" : "\u2922"}
      </button>

      {/* Route content renders in the Outlet grid cell (below player, left column) */}
      <div className={styles.routeContent}>
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

      {/* Theater overlay */}
      {prefs.theater && (
        <TheaterOverlay
          channel={selectedChannel}
          onExitTheater={() => updatePrefs({ theater: false })}
        />
      )}

      {/* Chat portaled into root layout's grid column */}
      {portalTarget && !prefs.chatCollapsed &&
        createPortal(
          <ChatPanel
            channelId={selectedChannelId}
            onCollapse={() => updatePrefs({ chatCollapsed: true })}
          />,
          portalTarget,
        )}

      {/* Chat expand tab (when collapsed) — arrow mirrors the collapse button */}
      {prefs.chatCollapsed && (
        <button
          type="button"
          className={styles.chatExpandTab}
          onClick={() => updatePrefs({ chatCollapsed: false })}
          aria-label="Show chat"
          title="Show chat"
        >
          {"\u2190"}
        </button>
      )}
    </ChatProvider>
  );
}


/** Channel info overlay shown on hover during theater mode. */
function TheaterOverlay({
  channel,
  onExitTheater,
}: {
  readonly channel: Channel | null;
  readonly onExitTheater: () => void;
}): React.ReactElement | null {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Show overlay when mouse is in the top 80px of the viewport
      if (e.clientY < 80) {
        setVisible(true);
        clearTimeout(timeoutRef.current);
      } else {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setVisible(false), 1500);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!channel) return null;

  return (
    <div
      className={clsx(styles.theaterOverlay, visible && styles.theaterOverlayVisible)}
      onMouseEnter={() => {
        setVisible(true);
        clearTimeout(timeoutRef.current);
      }}
      onMouseLeave={() => {
        timeoutRef.current = setTimeout(() => setVisible(false), 500);
      }}
    >
      <span className={styles.theaterChannelName}>{channel.name}</span>
      <span className={styles.theaterViewerCount}>
        {channel.viewerCount} {channel.viewerCount === 1 ? "viewer" : "viewers"}
      </span>
      <button
        type="button"
        className={styles.theaterExitButton}
        onClick={onExitTheater}
      >
        Exit Theater
      </button>
    </div>
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
          decoding="async"
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
