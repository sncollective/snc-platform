import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type React from "react";
import type { ChannelListResponse } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { EditorialSurface } from "../../components/playout/editorial-surface.js";
import { EditorialApiProvider, ADMIN_EDITORIAL_API } from "../../components/playout/editorial-api.js";
import { ConfirmDialog } from "../../components/ui/confirm-dialog.js";
import { toaster } from "../../components/ui/toast.js";
import { fetchApiServer } from "../../lib/api-server.js";
import {
  createChannel,
  deleteChannel,
  fetchChannelQueue,
} from "../../lib/playout-channels.js";
import { SpineProvider, useSpineTopic } from "../../contexts/spine-context.js";
import errorStyles from "../../styles/error-alert.module.css";
import formStyles from "../../styles/form.module.css";
import pageHeadingStyles from "../../styles/page-heading.module.css";
import listingStyles from "../../styles/listing-page.module.css";
import styles from "./playout.module.css";

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

  const [engineStatus, setEngineStatus] = useState<"ready" | "restarting" | null>(null);

  // Set when a channel create/delete restarts the engine: the page reload is
  // deferred until the engine is actually ready (no fixed 500ms race that reloads
  // mid-restart and never shows the pulsing tab).
  const [reloadWhenReady, setReloadWhenReady] = useState(false);

  // Resolve engine-restart honestly off the real event (not a 500ms race). The surface
  // owns queue refetch on its own `playout` subscription; this admin-only handler shares
  // the topic (the spine store fans the event out to every subscribed handler).
  useSpineTopic("playout", (event) => {
    if (event.type === "playout.engine-restarted") {
      setEngineStatus("ready");
    }
  });

  useEffect(() => {
    if (reloadWhenReady && engineStatus === "ready") {
      window.location.reload();
    }
  }, [reloadWhenReady, engineStatus]);

  // Channel creation state
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);

  // Channel deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingChannel, setIsDeletingChannel] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);

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
                id={`playout-tab-${ch.id}`}
                aria-selected={ch.id === selectedChannelId}
                // Single swap-in-place panel: every tab controls the one rendered
                // panel (stable id), not a per-channel panel that isn't in the DOM.
                aria-controls="playout-panel"
                className={[
                  styles.channelTab,
                  ch.id === selectedChannelId ? styles.channelTabActive : null,
                  engineStatus === "restarting" ? styles.channelTabRestarting : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  setSelectedChannelId(ch.id);
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
                aria-label="New channel name"
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

      {/* Channel-scoped editorial body: a fresh surface per channel (keyed) so internal
          pool/queue state resets cleanly when the operator switches tabs. */}
      {selectedChannelId !== null && (
        <div
          role="tabpanel"
          id="playout-panel"
          aria-labelledby={`playout-tab-${selectedChannelId}`}
          tabIndex={0}
          className={styles.tabPanel}
        >
          {/* Channel CRUD error (create/delete) — the surface owns its own queue/pool
              action errors internally. */}
          {actionError !== null && (
            <div className={errorStyles.error} role="alert">
              {actionError}
            </div>
          )}

          <EditorialApiProvider api={ADMIN_EDITORIAL_API}>
            <EditorialSurface
              key={selectedChannelId}
              channelId={selectedChannelId}
              spineTopic="playout"
              capabilities={{ channelCrud: true, broadcastBanner: true, channelTabs: true, canCreateContent: true }}
            />
          </EditorialApiProvider>
        </div>
      )}
    </div>
  );
}
