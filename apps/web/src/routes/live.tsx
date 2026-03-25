import { createFileRoute, redirect } from "@tanstack/react-router";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StreamStatus } from "@snc/shared";

import { RouteErrorBoundary } from "../components/error/route-error-boundary.js";
import { fetchApiServer } from "../lib/api-server.js";
import { isFeatureEnabled } from "../lib/config.js";
import { apiGet } from "../lib/fetch-utils.js";

import styles from "./live.module.css";

// ── Constants ──

const POLL_INTERVAL_MS = 15_000;

// ── Route ──

export const Route = createFileRoute("/live")({
  errorComponent: RouteErrorBoundary,
  loader: async (): Promise<{ initialStatus: StreamStatus | null }> => {
    if (!isFeatureEnabled("streaming")) throw redirect({ to: "/" });
    try {
      const initialStatus = (await fetchApiServer({
        data: "/api/streaming/status",
      })) as StreamStatus;
      return { initialStatus };
    } catch {
      return { initialStatus: null };
    }
  },
  component: LivePage,
});

// ── Polling Hook ──

/** Poll the streaming status endpoint on a fixed interval. */
function useStreamStatus(initial: StreamStatus | null): StreamStatus | null {
  const [status, setStatus] = useState<StreamStatus | null>(initial);
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const next = await apiGet<StreamStatus>("/api/streaming/status");
      if (mountedRef.current) setStatus(next);
    } catch {
      // Transient failure — keep showing the last known status
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

  return status;
}

// ── Components ──

/** Main live stream page. */
function LivePage(): React.ReactElement {
  const { initialStatus } = Route.useLoaderData();
  const status = useStreamStatus(initialStatus);

  const isLive = status !== null && status.isLive && status.hlsUrl !== null;

  return (
    <div className={styles.page}>
      <div className={styles.playerContainer}>
        {isLive ? (
          <StreamPlayer hlsUrl={status!.hlsUrl!} />
        ) : (
          <ComingSoonPlaceholder />
        )}
      </div>
      {isLive && (
        <div className={styles.streamInfo}>
          <StreamStatusBar viewerCount={status!.viewerCount} />
        </div>
      )}
    </div>
  );
}

/** Vidstack HLS player with dynamic import to avoid SSR browser-API issues. */
function StreamPlayer({ hlsUrl }: { readonly hlsUrl: string }): React.ReactElement {
  const [playerModule, setPlayerModule] = useState<{
    MediaPlayer: React.ComponentType<Record<string, unknown>>;
    MediaProvider: React.ComponentType;
  } | null>(null);

  useEffect(() => {
    import("vidstack").then((mod) => {
      setPlayerModule({
        MediaPlayer: mod.MediaPlayer as React.ComponentType<Record<string, unknown>>,
        MediaProvider: mod.MediaProvider as React.ComponentType,
      });
    }).catch(() => {
      // Silently ignore — skeleton remains visible
    });
  }, []);

  if (playerModule === null) {
    return <div className={styles.playerSkeleton} />;
  }

  const { MediaPlayer, MediaProvider } = playerModule;

  return (
    <MediaPlayer src={hlsUrl} autoPlay className={styles.player}>
      <MediaProvider />
    </MediaPlayer>
  );
}

/** Live status bar showing viewer count. */
function StreamStatusBar({ viewerCount }: { readonly viewerCount: number }): React.ReactElement {
  const viewerLabel = viewerCount === 1 ? "viewer" : "viewers";

  return (
    <div className={styles.statusBar}>
      <div className={styles.liveIndicator}>
        <span className={styles.liveDot} aria-hidden="true" />
        LIVE
      </div>
      <span className={styles.viewerCount}>
        {viewerCount} {viewerLabel}
      </span>
    </div>
  );
}

/** Placeholder shown when no live stream is active. */
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
