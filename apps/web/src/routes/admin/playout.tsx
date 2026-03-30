import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { PlayoutItem, PlayoutItemListResponse, PlayoutStatus, ChannelListResponse } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { AddFilmForm } from "../../components/admin/add-film-form.js";
import { PlaylistItemRow } from "../../components/admin/playlist-item-row.js";
import { isFeatureEnabled } from "../../lib/config.js";
import { fetchApiServer } from "../../lib/api-server.js";
import {
  deletePlayoutItem,
  fetchPlayoutStatus,
  skipPlayoutTrack,
  queuePlayoutItem,
  savePlaylist,
} from "../../lib/playout.js";
import errorStyles from "../../styles/error-alert.module.css";
import pageHeadingStyles from "../../styles/page-heading.module.css";
import listingStyles from "../../styles/listing-page.module.css";
import styles from "./playout.module.css";

// ── Constants ──

const STATUS_POLL_INTERVAL_MS = 3_000;

// ── Route ──

export const Route = createFileRoute("/admin/playout")({
  beforeLoad: async () => {
    if (!isFeatureEnabled("streaming")) throw redirect({ to: "/" });
  },
  loader: async (): Promise<{
    items: PlayoutItemListResponse;
    channels: ChannelListResponse | null;
  }> => {
    const [data, channelsRes] = await Promise.all([
      fetchApiServer({ data: "/api/playout/items" }) as Promise<PlayoutItemListResponse>,
      fetchApiServer({ data: "/api/streaming/status" }).catch(() => null) as Promise<ChannelListResponse | null>,
    ]);
    return { items: data, channels: channelsRes };
  },
  head: () => ({
    meta: [{ title: "Playout Admin — S/NC" }],
  }),
  errorComponent: RouteErrorBoundary,
  component: PlayoutPage,
});

// ── Polling Hook ──

/** Poll the playout status endpoint on a fixed interval. */
function usePlayoutStatus(): PlayoutStatus | null {
  const [status, setStatus] = useState<PlayoutStatus | null>(null);
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const next = await fetchPlayoutStatus();
      if (mountedRef.current) setStatus(next);
    } catch {
      // Transient failure — keep showing the last known status
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    // Poll immediately, then on interval
    void poll();

    const schedule = () => {
      timeoutId = setTimeout(async () => {
        await poll();
        if (mountedRef.current) schedule();
      }, STATUS_POLL_INTERVAL_MS);
    };

    schedule();

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [poll]);

  return status;
}

// ── Broadcast Status Component ──

/** Show S/NC TV broadcast channel status at the top of the playout admin page. */
function BroadcastStatus({ channels }: { channels: ChannelListResponse | null }): React.ReactElement | null {
  const broadcast = channels?.channels.find((ch) => ch.type === "broadcast");
  if (!broadcast) return null;

  // Check if a live creator has taken over S/NC TV
  const liveCreator = channels?.channels.find(
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
          {broadcast.nowPlaying.director && ` — ${broadcast.nowPlaying.director}`}
        </div>
      ) : null}
    </section>
  );
}

// ── Page Component ──

/** Admin playout management page. */
function PlayoutPage(): React.ReactElement {
  const { items: initialData, channels } = Route.useLoaderData();
  const [serverItems, setServerItems] = useState<PlayoutItem[]>(initialData.items);
  const [pendingItems, setPendingItems] = useState<PlayoutItem[]>(initialData.items);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const status = usePlayoutStatus();

  const isDirty = useMemo(() => {
    if (serverItems.length !== pendingItems.length) return true;
    return serverItems.some((s, i) => {
      const p = pendingItems[i];
      return !p || s.id !== p.id || s.enabled !== p.enabled || s.position !== p.position;
    });
  }, [serverItems, pendingItems]);

  const handleSkip = async (): Promise<void> => {
    setSkipError(null);
    try {
      await skipPlayoutTrack();
    } catch (e) {
      setSkipError(e instanceof Error ? e.message : "Failed to skip track");
    }
  };

  const handleToggleEnabled = (item: PlayoutItem): void => {
    setPendingItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, enabled: !i.enabled } : i)),
    );
  };

  const handleDelete = async (id: string): Promise<void> => {
    setActionError(null);
    try {
      await deletePlayoutItem(id);
      setServerItems((prev) => prev.filter((i) => i.id !== id));
      setPendingItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete item");
    }
  };

  const handleMoveUp = (index: number): void => {
    if (index === 0) return;
    setPendingItems((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index - 1, 0, item!);
      return next;
    });
  };

  const handleMoveDown = (index: number): void => {
    if (index === pendingItems.length - 1) return;
    setPendingItems((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + 1, 0, item!);
      return next;
    });
  };

  const handlePlayNext = async (id: string): Promise<void> => {
    setActionError(null);
    try {
      await queuePlayoutItem(id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to queue item");
    }
  };

  const handleSavePlaylist = async (): Promise<void> => {
    setActionError(null);
    setIsSaving(true);
    try {
      const result = await savePlaylist({
        items: pendingItems.map((item, i) => ({
          id: item.id,
          enabled: item.enabled,
          position: i,
        })),
      });
      setServerItems(result.items);
      setPendingItems(result.items);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to save playlist");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = (): void => {
    setPendingItems(serverItems);
  };

  const handleItemAdded = (item: PlayoutItem): void => {
    setServerItems((prev) => [...prev, item]);
    setPendingItems((prev) => [...prev, item]);
    setShowAddForm(false);
  };

  return (
    <div className={styles.page}>
      <h1 className={pageHeadingStyles.heading}>Playout</h1>

      <BroadcastStatus channels={channels} />

      {/* Now-Playing Card */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Now Playing</h2>

        {skipError !== null && (
          <div className={errorStyles.error} role="alert">
            {skipError}
          </div>
        )}

        {status?.nowPlaying !== null && status?.nowPlaying !== undefined ? (
          <div className={styles.nowPlayingCard}>
            <div className={styles.nowPlayingInfo}>
              <span className={styles.nowPlayingTitle}>
                {status.nowPlaying.title}
                {status.nowPlaying.year !== null && ` (${status.nowPlaying.year})`}
              </span>
              {status.nowPlaying.director !== null && (
                <span className={styles.nowPlayingDirector}>
                  dir. {status.nowPlaying.director}
                </span>
              )}
              {status.nowPlaying.duration !== null && (
                <span className={styles.nowPlayingTime}>
                  {formatSeconds(status.nowPlaying.elapsed)} /{" "}
                  {formatSeconds(status.nowPlaying.duration)}
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
            {status === null ? "Loading…" : "Nothing playing"}
          </p>
        )}
      </section>

      {/* Queue */}
      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Queue</h2>
        {status?.queuedItems && status.queuedItems.length > 0 ? (
          <ul className={styles.queueList}>
            {status.queuedItems.map((entry) => (
              <li key={entry.itemId + entry.queuedAt} className={styles.queueItem}>
                <span className={styles.queueItemTitle}>{entry.title}</span>
                <span className={styles.queueItemTime}>
                  queued {new Date(entry.queuedAt).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.queueEmpty}>Queue empty — playlist will auto-play.</p>
        )}
      </section>

      {/* Playlist Management */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionHeading}>Playlist</h2>
          <div className={styles.playlistActions}>
            {isDirty && (
              <>
                <button
                  type="button"
                  className={styles.discardButton}
                  onClick={handleDiscardChanges}
                >
                  Discard
                </button>
                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={() => void handleSavePlaylist()}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving…" : "Save Playlist"}
                </button>
              </>
            )}
            <button
              type="button"
              className={styles.addButton}
              onClick={() => setShowAddForm(true)}
            >
              Add Film
            </button>
          </div>
        </div>

        {actionError !== null && (
          <div className={errorStyles.error} role="alert">
            {actionError}
          </div>
        )}

        {showAddForm && (
          <AddFilmForm
            onAdded={handleItemAdded}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {pendingItems.length === 0 && !showAddForm ? (
          <p className={listingStyles.status}>No items in playlist</p>
        ) : (
          <ul className={styles.playlistItems} aria-label="Playlist">
            {pendingItems.map((item, index) => (
              <PlaylistItemRow
                key={item.id}
                item={item}
                index={index}
                total={pendingItems.length}
                onToggleEnabled={() => handleToggleEnabled(item)}
                onDelete={() => void handleDelete(item.id)}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
                onPlayNext={() => void handlePlayNext(item.id)}
              />
            ))}
          </ul>
        )}
      </section>
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
