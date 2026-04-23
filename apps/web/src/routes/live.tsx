import { createFileRoute } from "@tanstack/react-router";
import { clsx } from "clsx/lite";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { z } from "zod/mini";
import type { Channel, ChannelListResponse } from "@snc/shared";

import { RouteErrorBoundary } from "../components/error/route-error-boundary.js";
import { useGlobalPlayer } from "../contexts/global-player-context.js";
import type { LiveLayout, MediaMetadata } from "../contexts/global-player-context.js";
import { ChatPanel } from "../components/chat/chat-panel.js";
import { fetchApiServer } from "../lib/api-server.js";
import { apiGet } from "../lib/fetch-utils.js";
import { ChatProvider } from "../contexts/chat-context.js";
import { useSession } from "../lib/auth.js";

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
  validateSearch: z.object({
    channel: z.optional(z.string()),
  }),
  loader: async (): Promise<{ initial: ChannelListResponse | null }> => {
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

interface ChannelListState {
  readonly data: ChannelListResponse | null;
  /** True until the first fetch completes when no SSR data was available. */
  readonly isLoading: boolean;
}

/** Poll the channel list endpoint on a fixed interval. */
function useChannelList(initial: ChannelListResponse | null): ChannelListState {
  const [state, setState] = useState<ChannelListState>({
    data: initial,
    isLoading: initial === null,
  });
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const next = await apiGet<ChannelListResponse>("/api/streaming/status");
      if (mountedRef.current) setState({ data: next, isLoading: false });
    } catch {
      // Transient failure — keep showing the last known channel list
      if (mountedRef.current) setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    // If no SSR data, fetch immediately to populate the page
    if (initial === null) {
      void poll();
    }

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
  }, [poll, initial]);

  return state;
}

// ── Components ──

/** Main live stream page. */
function LivePage(): React.ReactElement {
  const { initial } = Route.useLoaderData();
  const { channel: channelFromUrl } = Route.useSearch();
  const { data: channelList, isLoading } = useChannelList(initial);
  const { actions, chatPortalRef } = useGlobalPlayer();
  const session = useSession();
  const currentUserId = session.data?.user?.id ?? null;

  const channels = channelList?.channels ?? [];
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<LayoutPrefs>(getInitialPrefs);

  // ── Controls visibility (window-level hover/touch) ──
  // Handlers live on window because the player is rendered at root-grid level
  // via global-player-context, outside this component's JSX tree — a route-scoped
  // element can't cover the player region.
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const showControls = (timeoutMs: number) => {
      setControlsVisible(true);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = setTimeout(() => setControlsVisible(false), timeoutMs);
    };
    const onMouseMove = () => showControls(2000);
    const onTouchStart = () => showControls(3000);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchstart", onTouchStart);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchstart", onTouchStart);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  const selectedChannel =
    channels.find((c) => c.id === selectedChannelId) ?? null;
  const hasChannels = channels.length > 0;
  const isStreaming = selectedChannel?.hlsUrl != null;

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
    actions.setLiveLayout(isStreaming ? liveLayout : null);
    return () => actions.setLiveLayout(null);
  }, [liveLayout, isStreaming, actions]);

  // ── Chat collapse signal: tell root layout to collapse chat column ──
  useEffect(() => {
    actions.setChatCollapsed(isStreaming && prefs.chatCollapsed);
    return () => actions.setChatCollapsed(false);
  }, [prefs.chatCollapsed, isStreaming, actions]);

  // ── Keyboard shortcuts: 't' to toggle theater, 'Escape' to exit theater ──
  useEffect(() => {
    if (!isStreaming) return;
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
      if (e.key === "Escape" && prefs.theater) {
        updatePrefs({ theater: false });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prefs.theater, isStreaming, updatePrefs]);

  // Auto-select channel on first load only.
  // Priority: URL `channel` param (e.g. from mini-player expand) > default channel from API.
  useEffect(() => {
    if (selectedChannelId) return;
    const seed = channelFromUrl ?? channelList?.defaultChannelId ?? null;
    if (seed) setSelectedChannelId(seed);
  }, [channelFromUrl, channelList?.defaultChannelId, selectedChannelId]);

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
        contentUrl: `/live?channel=${selectedChannel.id}`,
      };
      actions.play(metadata);
    }
  }, [selectedChannel?.id, actions]);

  // ── Portal target ──
  const portalTarget = chatPortalRef.current;

  return (
    <>
      {/* Route content renders in the Outlet grid cell (below player, left column) */}
      <div className={styles.routeContent}>
        {!hasChannels && !isLoading && <ComingSoonPlaceholder />}

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

      {/* Streaming-only UI: theater, chat, overlays */}
      {isStreaming && (
        <ChatProvider userId={currentUserId}>
          <button
            type="button"
            className={clsx(
              styles.theaterToggle,
              prefs.theater && styles.theaterToggleActive,
              prefs.chatCollapsed && styles.theaterToggleCollapsed,
              controlsVisible && styles.controlVisible,
            )}
            onClick={() => updatePrefs({ theater: !prefs.theater })}
            aria-label="Theater mode"
            aria-pressed={prefs.theater}
            title="Theater mode (t)"
          >
            {prefs.theater ? "\u2715" : "\u2922"}
          </button>

          {prefs.theater && (
            <TheaterOverlay channel={selectedChannel} visible={controlsVisible} />
          )}

          {portalTarget && !prefs.chatCollapsed &&
            createPortal(
              <ChatPanel channelId={selectedChannelId} />,
              portalTarget,
            )}

          <button
            type="button"
            className={clsx(
              styles.chatToggleTab,
              prefs.theater && styles.chatToggleTheater,
              prefs.chatCollapsed && styles.chatToggleCollapsed,
              controlsVisible && styles.controlVisible,
            )}
            onClick={() => updatePrefs({ chatCollapsed: !prefs.chatCollapsed })}
            aria-label={prefs.chatCollapsed ? "Show chat" : "Hide chat"}
            title={prefs.chatCollapsed ? "Show chat" : "Hide chat"}
          >
            {prefs.chatCollapsed ? "\u2190" : "\u2192"}
          </button>
        </ChatProvider>
      )}
    </>
  );
}


/** Channel info overlay shown during theater mode. Visibility is driven by the parent's `visible` prop. */
function TheaterOverlay({
  channel,
  visible,
}: {
  readonly channel: Channel | null;
  readonly visible: boolean;
}): React.ReactElement | null {
  if (!channel) return null;

  return (
    <div className={clsx(styles.theaterOverlay, visible && styles.theaterOverlayVisible)}>
      <span className={styles.theaterChannelName}>{channel.name}</span>
      <span className={styles.theaterViewerCount}>
        {channel.viewerCount} {channel.viewerCount === 1 ? "viewer" : "viewers"}
      </span>
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
      {(creator.avatar?.src ?? creator.avatarUrl) && (
        <img
          src={creator.avatar?.src ?? creator.avatarUrl ?? undefined}
          alt=""
          className={styles.creatorAvatar}
          width={32}
          height={32}
          decoding="async"
          {...(creator.avatar?.srcSet ? { srcSet: creator.avatar.srcSet } : {})}
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
