import { createFileRoute, Link } from "@tanstack/react-router";
import { clsx } from "clsx/lite";
import { Maximize2, PanelRightClose, PanelRightOpen, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { z } from "zod/mini";
import type { Channel, ChannelListResponse, ChannelLiveState } from "@snc/shared";

import { RouteErrorBoundary } from "../components/error/route-error-boundary.js";
import { useGlobalPlayer } from "../contexts/global-player-context.js";
import type { LiveLayout, MediaMetadata } from "../contexts/global-player-context.js";
import { ChatPanel } from "../components/chat/chat-panel.js";
import { fetchApiServer } from "../lib/api-server.js";
import { apiGet } from "../lib/fetch-utils.js";
import { usePolling } from "../hooks/use-polling.js";
import type { PollingState } from "../hooks/use-polling.js";
import {
  SpineProvider,
  useSpineStatus,
  useSpineTopic,
} from "../contexts/spine-context.js";
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

/**
 * Poll the channel list endpoint on a fixed interval. Seeds from SSR data when
 * present (no immediate refetch), otherwise fetches immediately to populate.
 */
function useChannelList(
  initial: ChannelListResponse | null,
): PollingState<ChannelListResponse> {
  return usePolling<ChannelListResponse>(
    () => apiGet<ChannelListResponse>("/api/streaming/status"),
    POLL_INTERVAL_MS,
    { initial },
  );
}

// ── Components ──

/**
 * Live page wrapped in a spine connection on the public `live` topic. The
 * SpineProvider is scoped to this route (not __root) so only the live page opens
 * an EventSource — respecting the server maxConnections cap for users elsewhere.
 */
function LivePage(): React.ReactElement {
  return (
    <SpineProvider topics={LIVE_TOPICS}>
      <LivePageInner />
    </SpineProvider>
  );
}

const LIVE_TOPICS = ["live"] as const;

/** Main live stream page. */
function LivePageInner(): React.ReactElement {
  const { initial } = Route.useLoaderData();
  const { channel: channelFromUrl } = Route.useSearch();
  const { data: channelList, isLoading, refetch } = useChannelList(initial);
  const { actions, chatPortalRef } = useGlobalPlayer();
  const session = useSession();
  const currentUserId = session.data?.user?.id ?? null;

  // Push/cache-invalidation: on any live-state change, re-fetch the authoritative
  // channel list (the derived liveState + fresh viewerCount ride that response). The
  // 15s usePolling interval stays as the degraded fallback when SSE is down.
  useSpineTopic("live", refetch);
  // Re-sync on (re)connect — a reconnect may have missed events (no Last-Event-ID).
  const spineStatus = useSpineStatus().status;
  useEffect(() => {
    if (spineStatus === "open") refetch();
  }, [spineStatus, refetch]);

  const channels = channelList?.channels ?? [];
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<LayoutPrefs>(getInitialPrefs);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

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
  // Derived airing-state from the channel-list response (live-experience-redesign-
  // live-state). "live-creator" is a creator on air — a keyed-in live-ingest stream
  // OR a creator takeover of the S/NC TV broadcast via Liquidsoap, which the old
  // identity proxy (ownership === "creator" && role === "live-ingest") missed.
  const selectedChannelIsLive = selectedChannel?.liveState === "live-creator";

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

  // ── Mobile chat tab signal: tell root layout to swap cells on mobile ──
  useEffect(() => {
    actions.setLiveMobileChatOpen(isStreaming && mobileChatOpen);
    return () => actions.setLiveMobileChatOpen(false);
  }, [mobileChatOpen, isStreaming, actions]);

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
        contentType: selectedChannelIsLive ? "live" : "playout",
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
        {isLoading && <ChannelZoneSkeleton />}
        {!hasChannels && !isLoading && <OfflinePlaceholder />}

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
                liveState={selectedChannel.liveState}
              />
            )}
          </div>
        )}

        {isStreaming && (
          <MobileTabBar chatOpen={mobileChatOpen} onSelect={setMobileChatOpen} />
        )}

        <div
          id="live-info-panel"
          role="tabpanel"
          className={clsx(styles.infoSections, mobileChatOpen && styles.infoSectionsChatOpen)}
        >
          {selectedChannel?.role === "playout" &&
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
            {prefs.theater ? <X size={16} /> : <Maximize2 size={16} />}
          </button>

          {prefs.theater && (
            <TheaterOverlay channel={selectedChannel} visible={controlsVisible} />
          )}

          {portalTarget && (!prefs.chatCollapsed || mobileChatOpen) &&
            createPortal(
              <div id="live-chat-panel" role="tabpanel" className={styles.chatTabPanel}>
                <ChatPanel channelId={selectedChannelId} />
              </div>,
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
            {prefs.chatCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
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
          {ch.name} — {LIVE_STATE_LABELS[ch.liveState]} ({ch.viewerCount}{" "}
          {ch.viewerCount === 1 ? "viewer" : "viewers"})
        </option>
      ))}
    </select>
  );
}

/** Short airing-state labels for the channel selector + status surfaces. */
const LIVE_STATE_LABELS: Record<ChannelLiveState, string> = {
  "live-creator": "Live",
  "scheduled-playout": "Scheduled",
  offline: "Offline",
};

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

/**
 * Live status bar showing viewer count and an honest airing-state indicator:
 * a LIVE badge for a creator on air, a "Scheduled" label for scheduled playout.
 */
function StreamStatusBar({
  viewerCount,
  liveState,
}: {
  readonly viewerCount: number;
  readonly liveState: ChannelLiveState;
}): React.ReactElement {
  const viewerLabel = viewerCount === 1 ? "viewer" : "viewers";

  return (
    <div className={styles.statusBar}>
      {liveState === "live-creator" && (
        <div className={styles.liveIndicator}>
          <span className={styles.liveDot} aria-hidden="true" />
          LIVE
        </div>
      )}
      {liveState === "scheduled-playout" && (
        <div className={styles.scheduledIndicator}>Scheduled</div>
      )}
      <span className={styles.viewerCount}>
        {viewerCount} {viewerLabel}
      </span>
    </div>
  );
}

/** Pulsing placeholder for the channel selector zone during the initial fetch. */
function ChannelZoneSkeleton(): React.ReactElement {
  return (
    <div className={styles.channelZoneSkeleton} role="status" aria-label="Loading channels">
      <span className={styles.skeletonSelect} aria-hidden="true" />
      <span className={styles.skeletonLine} aria-hidden="true" />
    </div>
  );
}

/** Mobile-only tab switcher between stream info and chat. Hidden ≥768px via CSS. */
function MobileTabBar({
  chatOpen,
  onSelect,
}: {
  readonly chatOpen: boolean;
  readonly onSelect: (chatOpen: boolean) => void;
}): React.ReactElement {
  return (
    <div className={styles.mobileTabBar} role="tablist" aria-label="Live page sections">
      <button
        type="button"
        role="tab"
        aria-selected={!chatOpen}
        aria-controls="live-info-panel"
        className={clsx(styles.mobileTab, !chatOpen && styles.mobileTabActive)}
        onClick={() => onSelect(false)}
      >
        Info
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={chatOpen}
        aria-controls="live-chat-panel"
        className={clsx(styles.mobileTab, chatOpen && styles.mobileTabActive)}
        onClick={() => onSelect(true)}
      >
        Chat
      </button>
    </div>
  );
}

/** Placeholder shown when no channels are active. */
function OfflinePlaceholder(): React.ReactElement {
  return (
    <div className={styles.offline}>
      <h1 className={styles.offlineHeading}>Nothing live right now</h1>
      <p className={styles.offlineText}>
        No channels are streaming at the moment. Check the calendar for upcoming
        shows and streams.
      </p>
      <Link to="/calendar" className={styles.offlineCalendarLink}>
        View the calendar
      </Link>
    </div>
  );
}
