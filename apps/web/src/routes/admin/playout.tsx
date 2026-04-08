import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { toaster } from "../../components/ui/toast.js";
import { fetchApiServer } from "../../lib/api-server.js";
import {
  assignChannelContent,
  createChannel,
  fetchChannelContent,
  fetchChannelQueue,
  insertQueueItem,
  removeChannelContent,
  removeQueueItem,
  skipChannelTrack,
} from "../../lib/playout-channels.js";
import { retryPlayoutIngest } from "../../lib/playout.js";
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
    const playoutChannels = allChannels.filter((c) => c.type === "playout");
    return { allChannels, playoutChannels };
  },
  head: () => ({
    meta: [{ title: "Playout Admin — S/NC" }],
  }),
  errorComponent: RouteErrorBoundary,
  component: PlayoutPage,
});

// ── Channel Queue Hook ──

/** Poll channel queue status every 3 seconds. Returns null while loading or when no channel is selected. */
function useChannelQueue(channelId: string | null): ChannelQueueStatus | null {
  const [status, setStatus] = useState<ChannelQueueStatus | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setStatus(null);

    if (!channelId) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async (): Promise<void> => {
      try {
        const data = await fetchChannelQueue(channelId);
        if (mountedRef.current) setStatus(data);
      } catch {
        // Keep last known state on transient failure
      }
      if (mountedRef.current) {
        timeoutId = setTimeout(() => void poll(), QUEUE_POLL_INTERVAL_MS);
      }
    };

    void poll();

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [channelId]);

  return status;
}

// ── Broadcast Status Component ──

/** Show S/NC TV broadcast channel status at the top of the playout admin page. */
function BroadcastStatus({
  channels,
}: {
  channels: ChannelListResponse["channels"];
}): React.ReactElement | null {
  const broadcast = channels.find((ch) => ch.type === "broadcast");
  if (!broadcast) return null;

  const liveCreator = channels.find(
    (ch) => ch.type === "live" && ch.creator,
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
      {liveCreator ? (
        <div className={styles.nowPlaying}>
          <strong>Live:</strong> {liveCreator.creator!.displayName}
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

/** Admin playout management page — channel tabs, queue, and content pool. */
function PlayoutPage(): React.ReactElement {
  const { allChannels, playoutChannels } = Route.useLoaderData();

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    playoutChannels[0]?.id ?? null,
  );
  const queueStatus = useChannelQueue(selectedChannelId);

  const [poolItems, setPoolItems] = useState<ChannelContent[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSearchPicker, setShowSearchPicker] = useState<"queue" | "pool" | null>(null);

  const [skipError, setSkipError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Channel creation state
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  // Engine restart status indicator
  const [engineStatus, setEngineStatus] = useState<"ready" | "restarting" | null>(null);

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

  // Create a new playout channel
  const handleCreateChannel = async (): Promise<void> => {
    if (!newChannelName.trim()) return;
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
          pollEngineHealth();
        }
      }

      // Reload to pick up new channel in tabs (after toasts are shown)
      setTimeout(() => { window.location.reload(); }, 500);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to create channel");
    } finally {
      setIsCreatingChannel(false);
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
        <div style={{ marginTop: "var(--space-sm)", display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => setShowCreateChannel(!showCreateChannel)}
          >
            + New Channel
          </button>
          {showCreateChannel && (
            <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
              <input
                type="text"
                className={formStyles.input}
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="Channel name"
                disabled={isCreatingChannel}
              />
              <button
                type="button"
                className={formStyles.submitButton}
                onClick={() => void handleCreateChannel()}
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
        </div>
      </div>

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

            {queueStatus?.nowPlaying != null ? (
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
              <p className={listingStyles.status}>
                {queueStatus === null ? "Loading…" : "Nothing playing"}
              </p>
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

// ── Helpers ──

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
