import { AppError, ok, err } from "@snc/shared";
import type { Result, NowPlaying } from "@snc/shared";

import { config } from "../config.js";
import { wrapExternalError } from "./external-error.js";
import { getActiveChannels, selectDefaultChannel } from "./channels.js";
import type { ChannelInfo } from "./channels.js";
import { orchestrator } from "../routes/playout-channels.init.js";
import { getNowPlaying as getLiquidsoapNowPlaying } from "./liquidsoap.js";

// ── Public Types ──

/** Aggregated channel list with viewer counts and now-playing state for each channel. */
export type ChannelListResult = {
  channels: Array<ChannelInfo & { viewerCount: number; nowPlaying: NowPlaying | null }>;
  defaultChannelId: string | null;
};

// ── Module-Level Configuration ──

const SRS_API_URL: string | null = config.SRS_API_URL ?? null;

// ── Private Helpers ──

const wrapSrsError = wrapExternalError("SRS_ERROR");

const ensureConfigured = (): Result<void, AppError> => {
  if (SRS_API_URL === null) {
    return err(
      new AppError(
        "STREAMING_NOT_CONFIGURED",
        "SRS streaming is not configured",
        503,
      ),
    );
  }
  return ok(undefined);
};

// ── SRS API Types ──

type SrsStreamsResponse = {
  code: number;
  streams: Array<{
    name: string;
    publish: { active: boolean };
    clients: number;
  }>;
};

// ── Public API ──

/**
 * Fetch active channels enriched with SRS viewer counts.
 *
 * Queries the channels table for active channels, then fetches the SRS streams
 * API to get live viewer counts. Returns a channel list with priority-based
 * default selection. SRS viewer counts are best-effort — channels are still
 * returned with viewerCount: 0 if SRS is unreachable.
 */
export const getChannelList = async (): Promise<
  Result<ChannelListResult, AppError>
> => {
  const configured = ensureConfigured();
  if (!configured.ok) return err(configured.error);

  try {
    const activeChannels = await getActiveChannels();

    // Kick off SRS streams fetch, Liquidsoap now-playing, and batch queue status in parallel
    const playoutIds = activeChannels
      .filter((ch) => ch.type === "playout")
      .map((ch) => ch.id);
    const hasBroadcast = activeChannels.some((ch) => ch.type === "broadcast");

    const [srsResult, liquidsoapResult, queueStatusMap] = await Promise.allSettled([
      fetch(`${SRS_API_URL!}/api/v1/streams/`, {
        signal: AbortSignal.timeout(2_000),
      }).then(async (response) => {
        if (!response.ok) return new Map<string, number>();
        const data = (await response.json()) as SrsStreamsResponse;
        const counts = new Map<string, number>();
        for (const stream of data.streams) {
          if (stream.publish.active) {
            counts.set(stream.name, stream.clients);
          }
        }
        return counts;
      }),
      hasBroadcast ? getLiquidsoapNowPlaying() : Promise.resolve(null),
      playoutIds.length > 0
        ? orchestrator.getMultiChannelQueueStatus(playoutIds)
        : Promise.resolve(new Map<string, import("@snc/shared").ChannelQueueStatus>()),
    ]);

    const srsViewerCounts = srsResult.status === "fulfilled"
      ? srsResult.value
      : new Map<string, number>();
    const liquidsoapNowPlaying = liquidsoapResult.status === "fulfilled"
      ? liquidsoapResult.value
      : null;
    const queueMap = queueStatusMap.status === "fulfilled"
      ? queueStatusMap.value
      : new Map<string, import("@snc/shared").ChannelQueueStatus>();

    const enrichedBase = activeChannels.map((ch) => ({
      ...ch,
      viewerCount: srsViewerCounts.get(ch.srsStreamName) ?? 0,
    }));

    // Enrich playout and broadcast channels with now-playing metadata
    const enriched = enrichedBase.map((ch) => {
      if (ch.type === "playout") {
        const status = queueMap.get(ch.id);
        if (status?.nowPlaying) {
          const np = status.nowPlaying;
          return {
            ...ch,
            nowPlaying: {
              itemId: np.playoutItemId,
              title: np.title,
              year: null,
              director: null,
              duration: np.duration,
              elapsed: -1, // DB doesn't track elapsed; Phase 3 can add Liquidsoap poll
              remaining: -1,
            },
          };
        }
        return { ...ch, nowPlaying: null };
      }

      if (ch.type === "broadcast") {
        if (!liquidsoapNowPlaying) return { ...ch, nowPlaying: null };
        return {
          ...ch,
          nowPlaying: {
            itemId: null,
            title: liquidsoapNowPlaying.title ?? null,
            year: null,
            director: null,
            duration: null,
            elapsed: liquidsoapNowPlaying.elapsed,
            remaining: liquidsoapNowPlaying.remaining,
          },
        };
      }

      return { ...ch, nowPlaying: null };
    });

    return ok({
      channels: enriched,
      defaultChannelId: selectDefaultChannel(enrichedBase),
    });
  } catch (e) {
    return err(wrapSrsError(e));
  }
};
