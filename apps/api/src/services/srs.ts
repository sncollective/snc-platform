import { AppError, ok, err } from "@snc/shared";
import type { Result, NowPlaying, ChannelLiveState, ChannelRole } from "@snc/shared";

import { config } from "../config.js";
import { wrapExternalError } from "./external-error.js";
import { getActiveChannels, selectDefaultChannel } from "./channels.js";
import type { ChannelInfo } from "./channels.js";
import { orchestrator } from "../routes/playout-channels.init.js";
import { getNowPlaying as getLiquidsoapNowPlaying } from "./liquidsoap.js";
import { getAiringSource } from "./playout-live-state.js";

// ── Public Types ──

/** Aggregated channel list with viewer counts and now-playing state for each channel. */
export type ChannelListResult = {
  channels: Array<
    ChannelInfo & {
      viewerCount: number;
      nowPlaying: NowPlaying | null;
      liveState: ChannelLiveState;
    }
  >;
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

// ── Private Helpers ──

/**
 * Derive a channel's airing-state from the live signals.
 *
 * Covers the takeover-bypass case the live-experience-redesign epic flagged: a creator
 * taking over the S/NC TV broadcast goes through Liquidsoap (`getAiringSource()` → "live"),
 * not a per-channel SRS publish — so SRS-session alone would miss it.
 *
 * @param role - channel role facet
 * @param hasActiveSrsSession - true when SRS reports an active publish on this channel's stream
 * @param isAiring - true when scheduled/queue content is currently airing (nowPlaying present)
 * @returns the derived ChannelLiveState (never "unknown" — that engine state is mapped away)
 */
const deriveLiveState = (
  role: ChannelRole,
  hasActiveSrsSession: boolean,
  isAiring: boolean,
): ChannelLiveState => {
  if (role === "live-ingest") {
    return hasActiveSrsSession ? "live-creator" : "offline";
  }

  if (role === "broadcast") {
    // The broadcast (S/NC TV) fallback can be airing a live-creator takeover via
    // Liquidsoap, which bypasses per-channel SRS. getAiringSource() is the only
    // signal for that. It returns "unknown" until the first switch event after API
    // boot — treat unknown as the airing-derived state, never surface "unknown".
    const airing = getAiringSource();
    if (airing === "live") return "live-creator";
    return isAiring ? "scheduled-playout" : "offline";
  }

  // playout role: airing scheduled content → scheduled-playout, else offline.
  return isAiring ? "scheduled-playout" : "offline";
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
      .filter((ch) => ch.role === "playout")
      .map((ch) => ch.id);
    const hasBroadcast = activeChannels.some((ch) => ch.role === "broadcast");

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

    // Enrich playout and broadcast channels with now-playing metadata + derived
    // airing-state. liveState is computed from the same signals: role, an active SRS
    // session (presence in srsViewerCounts — populated only for publish.active streams),
    // and whether scheduled content is airing (nowPlaying non-null).
    const enriched = enrichedBase.map((ch) => {
      const hasActiveSrsSession = srsViewerCounts.has(ch.srsStreamName);

      let nowPlaying: NowPlaying | null = null;

      if (ch.role === "playout") {
        const status = queueMap.get(ch.id);
        if (status?.nowPlaying) {
          const np = status.nowPlaying;
          nowPlaying = {
            itemId: np.playoutItemId,
            title: np.title,
            year: null,
            director: null,
            duration: np.duration,
            elapsed: -1, // DB doesn't track elapsed; Phase 3 can add Liquidsoap poll
            remaining: -1,
          };
        }
      } else if (ch.role === "broadcast" && liquidsoapNowPlaying) {
        nowPlaying = {
          itemId: null,
          title: liquidsoapNowPlaying.title ?? null,
          year: null,
          director: null,
          duration: null,
          elapsed: liquidsoapNowPlaying.elapsed,
          remaining: liquidsoapNowPlaying.remaining,
        };
      }

      const liveState = deriveLiveState(
        ch.role,
        hasActiveSrsSession,
        nowPlaying !== null,
      );

      return { ...ch, nowPlaying, liveState };
    });

    return ok({
      channels: enriched,
      defaultChannelId: selectDefaultChannel(enrichedBase),
    });
  } catch (e) {
    return err(wrapSrsError(e));
  }
};
