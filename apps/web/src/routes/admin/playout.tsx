import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type React from "react";
import type {
  ChannelContent,
  ChannelListResponse,
  ChannelQueueStatus,
  PoolCandidate,
} from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { AddContentForm } from "../../components/admin/add-content-form.js";
import { ContentPoolTable } from "../../components/admin/content-pool-table.js";
import { ContentSearchPicker } from "../../components/admin/content-search-picker.js";
import { PoolItemPicker } from "../../components/admin/pool-item-picker.js";
import { QueueItemRow } from "../../components/admin/queue-item-row.js";
import { ConfirmDialog } from "../../components/ui/confirm-dialog.js";
import { toaster } from "../../components/ui/toast.js";
import { fetchApiServer } from "../../lib/api-server.js";
import {
  assignChannelContent,
  createChannel,
  deleteChannel,
  fetchChannelContent,
  fetchChannelQueue,
  insertQueueItem,
  removeChannelContent,
  removeQueueItem,
  skipChannelTrack,
} from "../../lib/playout-channels.js";
import { retryPlayoutIngest } from "../../lib/playout.js";
import { formatSeconds } from "../../lib/format-duration.js";
import { usePolling } from "../../hooks/use-polling.js";
import {
  SpineProvider,
  useSpineStatus,
  useSpineTopic,
} from "../../contexts/spine-context.js";
import type { SpineStatus } from "../../contexts/spine-store.js";
import errorStyles from "../../styles/error-alert.module.css";
import formStyles from "../../styles/form.module.css";
import pageHeadingStyles from "../../styles/page-heading.module.css";
import listingStyles from "../../styles/listing-page.module.css";
import styles from "./playout.module.css";

// ── Constants ──

const QUEUE_POLL_INTERVAL_MS = 3_000;

// ── Route ──

export const Route = createFileRoute("/admin/playout")({
  loader: async (): Promise<{
    allChannels: ChannelListResponse["channels"];
    playoutChannels: ChannelListResponse["channels"];
  }> => {
    // Fetch channel list only — queue status is deferred to useChannelQueue (client-side 3s poll)
    const channels = await (
      fetchApiServer({ data: "/api/streaming/status" }) as Promise<ChannelListResponse>
    ).catch(() => null);
    const allChannels = channels?.channels ?? [];
    const playoutChannels = allChannels.filter((c) => c.role === "playout");
    return { allChannels, playoutChannels };
  },
  head: () => ({
    meta: [{ title: "Playout Admin — S/NC" }],
  }),
  errorComponent: RouteErrorBoundary,
  component: PlayoutPage,
});

// ── Channel Queue Hook ──

interface ChannelQueueState {
  /** Latest queue status, or null while loading / no channel selected. */
  readonly data: ChannelQueueStatus | null;
  /** Epoch ms of the last successful (non-error) fetch — the freshness stamp. */
  readonly lastUpdatedAt: number | null;
  /** Trigger an immediate out-of-cycle re-fetch (e.g. on a spine event). */
  readonly refetch: () => void;
}

/**
 * Channel queue status: spine-driven re-fetch with a 3s poll as the degraded
 * fallback. `lastUpdatedAt` stamps every successful fetch so staleness is measured by
 * data age, not socket state (the spine can be open while a re-fetch fails).
 */
function useChannelQueue(channelId: string | null): ChannelQueueState {
  // The fetcher resolves null when no channel is selected, so no request fires;
  // re-subscribing on `channelId` resets status to null between channels.
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const { data, refetch } = usePolling<ChannelQueueStatus | null>(
    () =>
      channelId
        ? fetchChannelQueue(channelId).then((d) => {
            setLastUpdatedAt(Date.now());
            return d;
          })
        : Promise.resolve(null),
    QUEUE_POLL_INTERVAL_MS,
    { key: channelId },
  );

  return { data, lastUpdatedAt, refetch };
}

// ── Playout Status Bar ──

/** Default staleness threshold: ~2× the spine's 25s heartbeat — a missed window. */
const STALE_THRESHOLD_MS = 50_000;

/** Relative "updated Ns ago" label from a freshness stamp. */
function relativeAge(lastUpdatedAt: number | null): string {
  if (lastUpdatedAt === null) return "not yet updated";
  const secs = Math.max(0, Math.round((Date.now() - lastUpdatedAt) / 1000));
  if (secs < 60) return `updated ${secs}s ago`;
  return `updated ${Math.round(secs / 60)}m ago`;
}

/**
 * Connection-state indicator + stale banner. A persistent subtle "Live"/"Reconnecting"
 * pill, plus a prominent banner when the spine isn't open OR the data has aged past the
 * threshold — killing the silent-stale failure mode. Designed as a single status slot
 * that the future drift/restart banner (bold-channel-topology-drift-detection) can share.
 */
function PlayoutStatusBar({
  spineStatus,
  lastUpdatedAt,
  staleThresholdMs = STALE_THRESHOLD_MS,
}: {
  readonly spineStatus: SpineStatus;
  readonly lastUpdatedAt: number | null;
  readonly staleThresholdMs?: number;
}): React.ReactElement {
  const dataStale =
    lastUpdatedAt !== null && Date.now() - lastUpdatedAt > staleThresholdMs;
  const isStale = spineStatus !== "open" || dataStale;

  return (
    <div className={styles.statusBar}>
      <span
        className={spineStatus === "open" ? styles.connLive : styles.connReconnecting}
        aria-live="polite"
      >
        <span className={styles.connDot} aria-hidden="true" />
        {spineStatus === "open" ? "Live" : "Reconnecting…"}
      </span>
      {isStale && (
        <div className={styles.staleBanner} role="status">
          Data may be out of date — {relativeAge(lastUpdatedAt)}.
        </div>
      )}
    </div>
  );
}

// ── Broadcast Status Component ──

/** Show S/NC TV broadcast channel status at the top of the playout admin page. */
function BroadcastStatus({
  channels,
}: {
  channels: ChannelListResponse["channels"];
}): React.ReactElement | null {
  const broadcast = channels.find((ch) => ch.role === "broadcast");
  if (!broadcast) return null;

  // A creator is on air when the broadcast's derived liveState says so (covers the
  // Liquidsoap-takeover case the old identity proxy missed). The creator's name still
  // comes from the live-ingest channel — that data isn't on the broadcast row.
  const broadcastIsLiveCreator = broadcast.liveState === "live-creator";
  const liveCreator = channels.find(
    (ch) => ch.ownership === "creator" && ch.role === "live-ingest" && ch.creator,
  );

  return (
    <section className={styles.broadcastSection}>
      <h2 className={styles.sectionHeading}>S/NC TV</h2>
      <div className={styles.broadcastStatus}>
        <span className={broadcast.hlsUrl ? styles.statusLive : styles.statusOffline}>
          {broadcast.hlsUrl ? "On Air" : "Offline"}
        </span>
        {broadcast.viewerCount > 0 && (
          <span className={styles.viewerCount}>
            {broadcast.viewerCount} viewer{broadcast.viewerCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {broadcastIsLiveCreator ? (
        <div className={styles.nowPlaying}>
          <strong>Live:</strong> {liveCreator?.creator?.displayName ?? "Creator on air"}
        </div>
      ) : broadcast.nowPlaying ? (
        <div className={styles.nowPlaying}>
          <strong>Now Playing:</strong> {broadcast.nowPlaying.title ?? "Unknown"}
          {broadcast.nowPlaying.director != null && ` — ${broadcast.nowPlaying.director}`}
        </div>
      ) : null}
    </section>
  );
}

// ── Page Component ──

/**
 * Admin playout management page. Wrapped in a spine connection on the admin-access
 * `playout` topic so queue/now-playing/engine state are pushed (re-fetched on event),
 * not polled on a fixed 3s cycle. Route-scoped — only the admin playout page opens a
 * connection (respects the maxConnections cap for users elsewhere).
 */
function PlayoutPage(): React.ReactElement {
  return (
    <SpineProvider topics={PLAYOUT_TOPICS}>
      <PlayoutPageInner />
    </SpineProvider>
  );
}

const PLAYOUT_TOPICS = ["playout"] as const;

/** Channel tabs, queue, and content pool. */
function PlayoutPageInner(): React.ReactElement {
  const { allChannels, playoutChannels } = Route.useLoaderData();

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    playoutChannels[0]?.id ?? null,
  );
  const { data: queueStatus, lastUpdatedAt, refetch: refetchQueue } =
    useChannelQueue(selectedChannelId);

  const [engineStatus, setEngineStatus] = useState<"ready" | "restarting" | null>(null);

  // Spine-driven freshness: re-fetch the queue on a playout event instead of waiting
  // up to 3s, and resolve engine-restart honestly off the real event (not a 500ms
  // race). The poll inside useChannelQueue stays as the degraded fallback.
  // Set when a channel create/delete restarts the engine: the page reload is
  // deferred until the engine is actually ready (no fixed 500ms race that reloads
  // mid-restart and never shows the pulsing tab).
  const [reloadWhenReady, setReloadWhenReady] = useState(false);

  useSpineTopic("playout", (event) => {
    if (event.type === "playout.engine-restarted") {
      setEngineStatus("ready");
    }
    refetchQueue();
  });
  const spineStatus = useSpineStatus().status;

  useEffect(() => {
    if (reloadWhenReady && engineStatus === "ready") {
      window.location.reload();
    }
  }, [reloadWhenReady, engineStatus]);

  // Nothing-playing tri-state: a null queue is only "loading" before the first fetch.
  // Once we've fetched at least once but the data is stale or the spine is down, the
  // honest read is "Liquidsoap not responding", not a perpetual "Loading…".
  const queueNotResponding =
    queueStatus === null &&
    selectedChannelId !== null &&
    lastUpdatedAt !== null &&
    (spineStatus !== "open" || Date.now() - lastUpdatedAt > STALE_THRESHOLD_MS);

  const [poolItems, setPoolItems] = useState<ChannelContent[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSearchPicker, setShowSearchPicker] = useState<"queue" | "pool" | null>(null);

  const [skipError, setSkipError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Channel creation state
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);

  // Channel deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingChannel, setIsDeletingChannel] = useState(false);

  // Fetch content pool when selected channel changes
  useEffect(() => {
    if (!selectedChannelId) return;
    fetchChannelContent(selectedChannelId)
      .then((data) => setPoolItems(data.items))
      .catch(() => {});
  }, [selectedChannelId]);

  const handleSkip = async (): Promise<void> => {
    if (!selectedChannelId) return;
    setSkipError(null);
    try {
      await skipChannelTrack(selectedChannelId);
    } catch (e) {
      setSkipError(e instanceof Error ? e.message : "Failed to skip track");
    }
  };

  const handleRemoveQueueItem = async (entryId: string): Promise<void> => {
    if (!selectedChannelId) return;
    setActionError(null);
    try {
      await removeQueueItem(selectedChannelId, entryId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to remove queue item");
    }
  };

  const handlePlayNext = async (item: ChannelContent): Promise<void> => {
    if (!selectedChannelId || !item.playoutItemId) return;
    setActionError(null);
    setShowSearchPicker(null);
    try {
      await insertQueueItem(selectedChannelId, item.playoutItemId, 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to queue item");
    }
  };

  const handleAssignContent = async (item: PoolCandidate): Promise<void> => {
    if (!selectedChannelId) return;
    setActionError(null);
    setShowSearchPicker(null);
    try {
      if (item.sourceType === "playout") {
        await assignChannelContent(selectedChannelId, [item.id]);
      } else {
        await assignChannelContent(selectedChannelId, undefined, [item.id]);
      }
      // Refresh pool
      const data = await fetchChannelContent(selectedChannelId);
      setPoolItems(data.items);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to assign content");
    }
  };

  const handleRemovePoolItem = async (item: ChannelContent): Promise<void> => {
    if (!selectedChannelId) return;
    setActionError(null);
    try {
      if (item.playoutItemId !== null) {
        await removeChannelContent(selectedChannelId, [item.playoutItemId]);
      } else if (item.contentId !== null) {
        await removeChannelContent(selectedChannelId, undefined, [item.contentId]);
      }
      setPoolItems((prev) => prev.filter((p) => p.id !== item.id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to remove content");
    }
  };

  const handleRetryPoolItem = async (item: ChannelContent): Promise<void> => {
    if (!item.playoutItemId) return;
    setActionError(null);
    try {
      await retryPlayoutIngest(item.playoutItemId);
      // Refresh the pool to reflect the new processingStatus
      if (selectedChannelId) {
        const data = await fetchChannelContent(selectedChannelId);
        setPoolItems(data.items);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to retry ingest");
    }
  };

  // Poll pool data 3 times at 2-second intervals after upload completes,
  // catching ingest completion (duration extraction) (Unit 1)
  const handleUploadComplete = (): void => {
    let attempts = 0;
    const pollInterval = setInterval(() => {
      attempts++;
      if (!selectedChannelId || attempts > 3) {
        clearInterval(pollInterval);
        return;
      }
      fetchChannelContent(selectedChannelId)
        .then((data) => setPoolItems(data.items))
        .catch(() => {/* ignore transient failures */});
    }, 2000);
  };

  // Poll Liquidsoap health until ready or timeout
  const pollEngineHealth = (): void => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (attempts > 15) {
        clearInterval(interval);
        setEngineStatus(null);
        toaster.warning({
          title: "Playout engine slow to restart",
          description: "The engine may still be starting up. Refresh the page in a moment.",
        });
        return;
      }
      if (selectedChannelId) {
        fetchChannelQueue(selectedChannelId)
          .then(() => {
            clearInterval(interval);
            setEngineStatus("ready");
            toaster.success({ title: "Playout engine ready" });
          })
          .catch(() => {
            // Still restarting — continue polling
          });
      }
    }, 2000);
  };

  // Create a new playout channel (called after confirm dialog)
  const handleCreateChannel = async (): Promise<void> => {
    if (!newChannelName.trim()) return;
    setShowCreateConfirm(false);
    setIsCreatingChannel(true);
    try {
      const result = await createChannel(newChannelName.trim());
      setShowCreateChannel(false);
      setNewChannelName("");

      if (result.engineRestarting) {
        setEngineStatus("restarting");
        toaster.info({
          title: "Channel created",
          description: "Playout engine restarting with new configuration...",
        });

        if (result.engineReady) {
          setEngineStatus("ready");
          toaster.success({ title: "Playout engine ready" });
        } else {
          pollEngineHealth(); // no-spine fallback; the spine engine-restarted event also resolves it
        }
        // Reload once the engine is actually ready (spine event or poll), not on a timer.
        setReloadWhenReady(true);
      } else {
        // No restart — just reload to pick up the new channel in the tabs.
        window.location.reload();
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to create channel");
    } finally {
      setIsCreatingChannel(false);
    }
  };

  // Delete (deactivate) the selected playout channel
  const handleDeleteChannel = async (): Promise<void> => {
    if (!selectedChannelId) return;
    setIsDeletingChannel(true);
    try {
      await deleteChannel(selectedChannelId);
      setShowDeleteConfirm(false);
      setEngineStatus("restarting");
      toaster.info({
        title: "Channel deleted",
        description: "Playout engine restarting with updated configuration...",
      });
      pollEngineHealth(); // no-spine fallback; the spine engine-restarted event also resolves it
      // Reload once the engine is ready (spine event or poll), not on a timer.
      setReloadWhenReady(true);
    } catch (e) {
      setShowDeleteConfirm(false);
      setActionError(e instanceof Error ? e.message : "Failed to delete channel");
    } finally {
      setIsDeletingChannel(false);
    }
  };

  // Compute cumulative estimated start times for each upcoming queue entry
  const upcomingWithEstimates = (queueStatus?.upcoming ?? []).map((entry, index, arr) => {
    const cumulativeSecs = arr.slice(0, index).reduce<number | null>((acc, e) => {
      if (acc === null || e.duration === null) return null;
      return acc + e.duration;
    }, 0);
    return { entry, estimatedStart: cumulativeSecs };
  });

  return (
    <div className={styles.page}>
      <h1 className={pageHeadingStyles.heading}>Playout</h1>

      <PlayoutStatusBar spineStatus={spineStatus} lastUpdatedAt={lastUpdatedAt} />

      <BroadcastStatus channels={allChannels} />

      {/* Channel Tabs */}
      <div>
        {playoutChannels.length > 0 ? (
          <div className={styles.channelTabs} role="tablist" aria-label="Playout channels">
            {playoutChannels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                role="tab"
                aria-selected={ch.id === selectedChannelId}
                className={[
                  styles.channelTab,
                  ch.id === selectedChannelId ? styles.channelTabActive : null,
                  engineStatus === "restarting" ? styles.channelTabRestarting : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  setSelectedChannelId(ch.id);
                  setShowAddForm(false);
                  setShowSearchPicker(null);
                }}
              >
                {ch.name}
              </button>
            ))}
          </div>
        ) : (
          <p className={listingStyles.status}>No playout channels configured.</p>
        )}
        <div className={styles.newChannelRow}>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => setShowCreateChannel(!showCreateChannel)}
          >
            + New Channel
          </button>
          {showCreateChannel && (
            <div className={styles.newChannelForm}>
              <input
                type="text"
                className={[formStyles.input, styles.newChannelInput].join(" ")}
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="Channel name"
                disabled={isCreatingChannel}
              />
              <button
                type="button"
                className={formStyles.submitButton}
                onClick={() => setShowCreateConfirm(true)}
                disabled={isCreatingChannel || !newChannelName.trim()}
              >
                {isCreatingChannel ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => { setShowCreateChannel(false); setNewChannelName(""); }}
                disabled={isCreatingChannel}
              >
                Cancel
              </button>
            </div>
          )}
          {selectedChannelId !== null && (
            <button
              type="button"
              className={styles.deleteChannelButton}
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeletingChannel}
            >
              Delete channel
            </button>
          )}
        </div>
      </div>

      {/* Create channel confirm dialog */}
      <ConfirmDialog
        open={showCreateConfirm}
        tone="default"
        title="Create channel?"
        confirmLabel="Create channel"
        onConfirm={() => void handleCreateChannel()}
        onCancel={() => setShowCreateConfirm(false)}
      >
        Creating &ldquo;{newChannelName}&rdquo; briefly restarts the playout engine.
        Viewers may see a short interruption.
      </ConfirmDialog>

      {/* Delete channel confirm dialog */}
      {selectedChannelId !== null && (
        <ConfirmDialog
          open={showDeleteConfirm}
          tone="danger"
          title="Delete channel?"
          confirmLabel="Delete channel"
          isPending={isDeletingChannel}
          onConfirm={() => void handleDeleteChannel()}
          onCancel={() => setShowDeleteConfirm(false)}
        >
          &ldquo;{playoutChannels.find((ch) => ch.id === selectedChannelId)?.name ?? "This channel"}&rdquo; goes
          offline and is removed from playout. The playout engine briefly restarts &mdash; viewers
          may see a short interruption.
        </ConfirmDialog>
      )}

      {selectedChannelId !== null && (
        <>
          {/* Global action error */}
          {actionError !== null && (
            <div className={errorStyles.error} role="alert">
              {actionError}
            </div>
          )}

          {/* Now Playing */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Now Playing</h2>

            {skipError !== null && (
              <div className={errorStyles.error} role="alert">
                {skipError}
              </div>
            )}

            {queueStatus === null ? (
              <p className={listingStyles.status}>
                {queueNotResponding
                  ? "Playout engine not responding — data may be out of date."
                  : "Loading…"}
              </p>
            ) : queueStatus.nowPlaying != null ? (
              <div className={styles.nowPlayingCard}>
                <div className={styles.nowPlayingInfo}>
                  <span className={styles.nowPlayingTitle}>
                    {queueStatus.nowPlaying.title ?? "—"}
                  </span>
                  {queueStatus.nowPlaying.duration !== null && (
                    <span className={styles.nowPlayingTime}>
                      {formatSeconds(queueStatus.nowPlaying.duration)}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.skipButton}
                  onClick={() => void handleSkip()}
                >
                  Skip
                </button>
              </div>
            ) : (
              <div className={styles.nowPlayingCard}>
                <p className={listingStyles.status} style={{ margin: 0 }}>Nothing playing</p>
                <div className={styles.skipDisabledGroup}>
                  <button
                    type="button"
                    className={styles.skipButton}
                    disabled
                    aria-disabled="true"
                  >
                    Skip
                  </button>
                  <span className={styles.skipDisabledReason}>No active track</span>
                </div>
              </div>
            )}
          </section>

          {/* Queue */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionHeading}>Queue</h2>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={() =>
                    setShowSearchPicker(showSearchPicker === "queue" ? null : "queue")
                  }
                >
                  + Add to Queue
                </button>
                {showSearchPicker === "queue" && (
                  <PoolItemPicker
                    poolItems={poolItems}
                    onSelect={(item) => void handlePlayNext(item)}
                    onClose={() => setShowSearchPicker(null)}
                  />
                )}
              </div>
            </div>

            {upcomingWithEstimates.length > 0 ? (
              <ul className={styles.queueList} aria-label="Upcoming queue">
                {upcomingWithEstimates.map(({ entry, estimatedStart }) => (
                  <QueueItemRow
                    key={entry.id}
                    entry={entry}
                    estimatedStart={estimatedStart}
                    onRemove={() => void handleRemoveQueueItem(entry.id)}
                  />
                ))}
              </ul>
            ) : (
              <p className={styles.queueEmpty}>
                {queueStatus === null ? "Loading…" : "Queue empty — content pool will auto-play."}
              </p>
            )}
          </section>

          {/* Content Pool */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionHeading}>
                Content Pool
                {queueStatus !== null && ` (${queueStatus.poolSize} items)`}
              </h2>
              <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center", position: "relative" }}>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={() =>
                      setShowSearchPicker(showSearchPicker === "pool" ? null : "pool")
                    }
                  >
                    + Add Content
                  </button>
                  {showSearchPicker === "pool" && (
                    <ContentSearchPicker
                      channelId={selectedChannelId}
                      onSelect={(item) => void handleAssignContent(item)}
                      onClose={() => setShowSearchPicker(null)}
                    />
                  )}
                </div>
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={() => setShowAddForm(!showAddForm)}
                >
                  + Create New
                </button>
              </div>
            </div>

            {showAddForm && (
              <AddContentForm
                channelId={selectedChannelId}
                onAdded={() => {
                  fetchChannelContent(selectedChannelId)
                    .then((data) => setPoolItems(data.items))
                    .catch(() => {});
                  setShowAddForm(false);
                }}
                onUploadComplete={handleUploadComplete}
                onCancel={() => setShowAddForm(false)}
              />
            )}

            <ContentPoolTable
              items={poolItems}
              onRemove={(item) => void handleRemovePoolItem(item)}
              onRetry={(item) => void handleRetryPoolItem(item)}
            />
          </section>
        </>
      )}
    </div>
  );
}
