import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import type { PlayoutItem, PlayoutItemListResponse, PlayoutStatus } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { AddFilmForm } from "../../components/admin/add-film-form.js";
import { PlaylistItemRow } from "../../components/admin/playlist-item-row.js";
import { isFeatureEnabled } from "../../lib/config.js";
import { fetchApiServer } from "../../lib/api-server.js";
import {
  updatePlayoutItem,
  deletePlayoutItem,
  reorderPlayoutItems,
  fetchPlayoutStatus,
  skipPlayoutTrack,
  queuePlayoutItem,
} from "../../lib/playout.js";
import errorStyles from "../../styles/error-alert.module.css";
import buttonStyles from "../../styles/button.module.css";
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
  loader: async (): Promise<{ items: PlayoutItemListResponse }> => {
    const data = (await fetchApiServer({
      data: "/api/playout/items",
    })) as PlayoutItemListResponse;
    return { items: data };
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

// ── Page Component ──

/** Admin playout management page. */
function PlayoutPage(): React.ReactElement {
  const { items: initialData } = Route.useLoaderData();
  const [items, setItems] = useState<PlayoutItem[]>(
    initialData.items,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);

  const status = usePlayoutStatus();

  const handleSkip = async (): Promise<void> => {
    setSkipError(null);
    try {
      await skipPlayoutTrack();
    } catch (e) {
      setSkipError(e instanceof Error ? e.message : "Failed to skip track");
    }
  };

  const handleToggleEnabled = async (
    item: PlayoutItem,
  ): Promise<void> => {
    setActionError(null);
    try {
      const updated = await updatePlayoutItem(item.id, {
        enabled: !item.enabled,
      });
      setItems((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i)),
      );
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Failed to update item",
      );
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    setActionError(null);
    try {
      await deletePlayoutItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Failed to delete item",
      );
    }
  };

  const handleMoveUp = async (index: number): Promise<void> => {
    if (index === 0) return;
    setActionError(null);
    const newItems = [...items];
    const [item] = newItems.splice(index, 1);
    newItems.splice(index - 1, 0, item!);
    const orderedIds = newItems.map((i) => i.id);
    try {
      const result = await reorderPlayoutItems(orderedIds);
      setItems(result.items);
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Failed to reorder items",
      );
    }
  };

  const handleMoveDown = async (index: number): Promise<void> => {
    if (index === items.length - 1) return;
    setActionError(null);
    const newItems = [...items];
    const [item] = newItems.splice(index, 1);
    newItems.splice(index + 1, 0, item!);
    const orderedIds = newItems.map((i) => i.id);
    try {
      const result = await reorderPlayoutItems(orderedIds);
      setItems(result.items);
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Failed to reorder items",
      );
    }
  };

  const handlePlayNext = async (id: string): Promise<void> => {
    setActionError(null);
    try {
      await queuePlayoutItem(id);
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Failed to queue item",
      );
    }
  };

  const handleItemAdded = (item: PlayoutItem): void => {
    setItems((prev) => [...prev, item]);
    setShowAddForm(false);
  };

  return (
    <div className={styles.page}>
      <h1 className={pageHeadingStyles.heading}>Playout</h1>

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

      {/* Playlist Management */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionHeading}>Playlist</h2>
          <button
            type="button"
            className={buttonStyles.primaryButton}
            onClick={() => setShowAddForm(true)}
          >
            Add Film
          </button>
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

        {items.length === 0 && !showAddForm ? (
          <p className={listingStyles.status}>No items in playlist</p>
        ) : (
          <ul className={styles.playlistItems} aria-label="Playlist">
            {items.map((item, index) => (
              <PlaylistItemRow
                key={item.id}
                item={item}
                index={index}
                total={items.length}
                onToggleEnabled={() => void handleToggleEnabled(item)}
                onDelete={() => void handleDelete(item.id)}
                onMoveUp={() => void handleMoveUp(index)}
                onMoveDown={() => void handleMoveDown(index)}
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
