import { AppError, ok, err } from "@snc/shared";
import type { Result } from "@snc/shared";

import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";

// ── Types ──

export type LiquidsoapNowPlaying = {
  uri: string;
  title: string;
  elapsed: number;
  remaining: number;
};

// ── Interface ──

/** Operations the queue orchestrator needs from Liquidsoap. */
export type LiquidsoapClient = {
  /** Push a track URI to a channel's request.queue for prefetch + playback. */
  pushTrack(channelId: string, uri: string): Promise<Result<void, AppError>>;
  /** Skip the current track on a channel. */
  skipTrack(channelId: string): Promise<Result<void, AppError>>;
  /** Fetch now-playing metadata for a channel. Returns null if unavailable. */
  getNowPlaying(channelId: string): Promise<LiquidsoapNowPlaying | null>;
};

// ── Real Implementation ──

const logger = rootLogger.child({ service: "liquidsoap-client" });

/**
 * Create a Liquidsoap client that calls per-channel harbor endpoints.
 * Endpoint pattern: POST /channels/{channelId}/queue, POST /channels/{channelId}/skip,
 * GET /channels/{channelId}/now-playing.
 */
export const createLiquidsoapClient = (): LiquidsoapClient => {
  const baseUrl = config.LIQUIDSOAP_API_URL;

  const request = async (
    path: string,
    init?: RequestInit,
  ): Promise<Result<void, AppError>> => {
    if (!baseUrl) {
      return err(
        new AppError("LIQUIDSOAP_NOT_CONFIGURED", "Liquidsoap is not configured", 503),
      );
    }
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        signal: AbortSignal.timeout(3000),
        ...init,
      });
      if (!res.ok) {
        logger.error({ status: res.status, path }, "Liquidsoap request failed");
        return err(new AppError("LIQUIDSOAP_ERROR", "Playout service error", 502));
      }
      return ok(undefined);
    } catch (e) {
      logger.error(
        { error: e instanceof Error ? e.message : String(e), path },
        "Liquidsoap unreachable",
      );
      return err(new AppError("LIQUIDSOAP_ERROR", "Liquidsoap unreachable", 502));
    }
  };

  return {
    async pushTrack(channelId, uri) {
      const annotatedUri = `annotate:s3_uri="${uri}":${uri}`;
      return request(`/channels/${channelId}/queue`, {
        method: "POST",
        body: annotatedUri,
        headers: { "Content-Type": "text/plain" },
      });
    },

    async skipTrack(channelId) {
      return request(`/channels/${channelId}/skip`, { method: "POST" });
    },

    async getNowPlaying(channelId) {
      if (!baseUrl) return null;
      try {
        const res = await fetch(`${baseUrl}/channels/${channelId}/now-playing`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return null;
        return (await res.json()) as LiquidsoapNowPlaying;
      } catch {
        return null;
      }
    },
  };
};

// ── Stub (kept for tests) ──

/**
 * Create a stub Liquidsoap client that logs operations but does nothing.
 * Used in tests and when Liquidsoap is not configured.
 */
export const createStubLiquidsoapClient = (): LiquidsoapClient => ({
  async pushTrack(channelId, uri) {
    logger.info({ channelId, uri }, "STUB: pushTrack");
    return ok(undefined);
  },
  async skipTrack(channelId) {
    logger.info({ channelId }, "STUB: skipTrack");
    return ok(undefined);
  },
  async getNowPlaying() {
    return null;
  },
});
