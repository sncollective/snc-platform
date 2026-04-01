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

    // Fetch SRS viewer counts (best-effort — default to 0 on failure)
    const srsViewerCounts = new Map<string, number>();
    try {
      const response = await fetch(`${SRS_API_URL!}/api/v1/streams/`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        const data = (await response.json()) as SrsStreamsResponse;
        for (const stream of data.streams) {
          if (stream.publish.active) {
            srsViewerCounts.set(stream.name, stream.clients);
          }
        }
      }
    } catch {
      // SRS unreachable — continue with 0 viewer counts
    }

    const enrichedBase = activeChannels.map((ch) => ({
      ...ch,
      viewerCount: srsViewerCounts.get(ch.srsStreamName) ?? 0,
    }));

    // Enrich playout and broadcast channels with now-playing metadata (best-effort)
    const enriched = await Promise.all(
      enrichedBase.map(async (ch) => {
        if (ch.type === "playout") {
          // Playout: DB queue is source of truth — no Liquidsoap round-trip needed
          const queueStatus = await orchestrator.getChannelQueueStatus(ch.id);
          if (queueStatus.ok && queueStatus.value.nowPlaying) {
            const np = queueStatus.value.nowPlaying;
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
          // Broadcast: use Liquidsoap's /now-playing backward-compat endpoint for live elapsed/remaining
          const raw = await getLiquidsoapNowPlaying();
          if (!raw) return { ...ch, nowPlaying: null };
          return {
            ...ch,
            nowPlaying: {
              itemId: null,
              title: raw.title ?? null,
              year: null,
              director: null,
              duration: null,
              elapsed: raw.elapsed,
              remaining: raw.remaining,
            },
          };
        }

        return { ...ch, nowPlaying: null };
      }),
    );

    return ok({
      channels: enriched,
      defaultChannelId: selectDefaultChannel(enrichedBase),
    });
  } catch (e) {
    return err(wrapSrsError(e));
  }
};
