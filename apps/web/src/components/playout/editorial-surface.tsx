import { useEffect, useState } from "react";
import type React from "react";
import type {
  ChannelContent,
  ChannelQueueStatus,
  PoolCandidate,
  SseTopic,
} from "@snc/shared";

import { AddContentForm } from "../admin/add-content-form.js";
import { ContentPoolTable } from "../admin/content-pool-table.js";
import { ContentSearchPicker } from "../admin/content-search-picker.js";
import { PoolItemPicker } from "../admin/pool-item-picker.js";
import { QueueItemRow } from "../admin/queue-item-row.js";
import { useEditorialApi } from "./editorial-api.js";
import type { EditorialApi } from "./editorial-api.js";
import { retryPlayoutIngest } from "../../lib/playout.js";
import { formatSeconds } from "../../lib/format-duration.js";
import { usePolling } from "../../hooks/use-polling.js";
import { useSpineStatus, useSpineTopic } from "../../contexts/spine-context.js";
import type { SpineStatus } from "../../contexts/spine-store.js";
import errorStyles from "../../styles/error-alert.module.css";
import listingStyles from "../../styles/listing-page.module.css";
import styles from "../../routes/admin/playout.module.css";

// ── Constants ──

const QUEUE_POLL_INTERVAL_MS = 3_000;

/** Default staleness threshold: ~2× the spine's 25s heartbeat — a missed window. */
const STALE_THRESHOLD_MS = 50_000;

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
 *
 * @param fetchQueue - The injected queue fetcher (admin or creator scope).
 */
function useChannelQueue(
  channelId: string | null,
  fetchQueue: EditorialApi["fetchChannelQueue"],
): ChannelQueueState {
  // The fetcher resolves null when no channel is selected, so no request fires;
  // re-subscribing on `channelId` resets status to null between channels.
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const { data, refetch } = usePolling<ChannelQueueStatus | null>(
    () =>
      channelId
        ? fetchQueue(channelId).then((d) => {
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

// ── Editorial Surface ──

export interface EditorialSurfaceProps {
  readonly channelId: string;
  /**
   * Spine topic this surface subscribes to for queue-refetch. The admin mount passes
   * `"playout"`; the creator mount passes `"content"`. Kept a prop (not hardcoded) so
   * the `<SpineProvider topics={…}>` and topic choice live at the mount level.
   */
  readonly spineTopic: SseTopic;
  /** Capabilities the mount grants; creator mount omits CRUD/broadcast/tabs/create. */
  readonly capabilities: {
    readonly channelCrud: boolean; // admin only
    readonly broadcastBanner: boolean; // admin only
    readonly channelTabs: boolean; // admin only (creator = single channel)
    /**
     * Whether to render the "+ Create New" pool affordance. Admin only — it calls
     * the admin-scoped `createPlayoutItem` (`POST /api/playout/items`) and assigns
     * the returned playout-item id, which the creator content path rejects (creator
     * pools are content-only). Creators add to their pool via the search picker over
     * their own existing content instead.
     */
    readonly canCreateContent: boolean;
  };
}

/**
 * Channel-scoped editorial body: connection/stale status bar, Now Playing + Skip, the
 * editable Queue, and the Content Pool. Presentational over the channel-scoped playout
 * APIs — the mount owns multi-channel context (tabs, CRUD, engine-restart) and the
 * `<SpineProvider>`. Refetch is spine-driven on `spineTopic` with a 3s poll fallback.
 */
export function EditorialSurface({
  channelId,
  spineTopic,
  capabilities,
}: EditorialSurfaceProps): React.ReactElement {
  const api = useEditorialApi();
  const {
    fetchChannelQueue,
    fetchChannelContent,
    skipChannelTrack,
    insertQueueItem,
    removeQueueItem,
    assignChannelContent,
    removeChannelContent,
  } = api;

  const { data: queueStatus, lastUpdatedAt, refetch: refetchQueue } =
    useChannelQueue(channelId, fetchChannelQueue);

  // Spine-driven freshness: re-fetch the queue on a topic event instead of waiting up to
  // 3s. The poll inside useChannelQueue stays as the degraded fallback.
  useSpineTopic(spineTopic, () => {
    refetchQueue();
  });
  const spineStatus = useSpineStatus().status;

  // Nothing-playing tri-state: a null queue is only "loading" before the first fetch.
  // Once we've fetched at least once but the data is stale or the spine is down, the
  // honest read is "Liquidsoap not responding", not a perpetual "Loading…".
  const queueNotResponding =
    queueStatus === null &&
    lastUpdatedAt !== null &&
    (spineStatus !== "open" || Date.now() - lastUpdatedAt > STALE_THRESHOLD_MS);

  const [poolItems, setPoolItems] = useState<ChannelContent[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSearchPicker, setShowSearchPicker] = useState<"queue" | "pool" | null>(null);

  const [skipError, setSkipError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch content pool when the channel changes
  useEffect(() => {
    fetchChannelContent(channelId)
      .then((data) => setPoolItems(data.items))
      .catch(() => {});
  }, [channelId]);

  const handleSkip = async (): Promise<void> => {
    setSkipError(null);
    try {
      await skipChannelTrack(channelId);
    } catch (e) {
      setSkipError(e instanceof Error ? e.message : "Failed to skip track");
    }
  };

  const handleRemoveQueueItem = async (entryId: string): Promise<void> => {
    setActionError(null);
    try {
      await removeQueueItem(channelId, entryId);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to remove queue item");
    }
  };

  const handlePlayNext = async (item: ChannelContent): Promise<void> => {
    if (!item.playoutItemId) return;
    setActionError(null);
    setShowSearchPicker(null);
    try {
      await insertQueueItem(channelId, item.playoutItemId, 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to queue item");
    }
  };

  const handleAssignContent = async (item: PoolCandidate): Promise<void> => {
    setActionError(null);
    setShowSearchPicker(null);
    try {
      if (item.sourceType === "playout") {
        await assignChannelContent(channelId, [item.id]);
      } else {
        await assignChannelContent(channelId, undefined, [item.id]);
      }
      // Refresh pool
      const data = await fetchChannelContent(channelId);
      setPoolItems(data.items);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to assign content");
    }
  };

  const handleRemovePoolItem = async (item: ChannelContent): Promise<void> => {
    setActionError(null);
    try {
      if (item.playoutItemId !== null) {
        await removeChannelContent(channelId, [item.playoutItemId]);
      } else if (item.contentId !== null) {
        await removeChannelContent(channelId, undefined, [item.contentId]);
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
      const data = await fetchChannelContent(channelId);
      setPoolItems(data.items);
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
      if (attempts > 3) {
        clearInterval(pollInterval);
        return;
      }
      fetchChannelContent(channelId)
        .then((data) => setPoolItems(data.items))
        .catch(() => {/* ignore transient failures */});
    }, 2000);
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
    <>
      <PlayoutStatusBar spineStatus={spineStatus} lastUpdatedAt={lastUpdatedAt} />

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
                  channelId={channelId}
                  onSelect={(item) => void handleAssignContent(item)}
                  onClose={() => setShowSearchPicker(null)}
                />
              )}
            </div>
            {/* Admin-only: "Create New" calls the admin-scoped createPlayoutItem +
                playout-item assignment, which the creator content path rejects. */}
            {capabilities.canCreateContent && (
              <button
                type="button"
                className={styles.addButton}
                onClick={() => setShowAddForm(!showAddForm)}
              >
                + Create New
              </button>
            )}
          </div>
        </div>

        {capabilities.canCreateContent && showAddForm && (
          <AddContentForm
            channelId={channelId}
            onAdded={() => {
              fetchChannelContent(channelId)
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
  );
}
