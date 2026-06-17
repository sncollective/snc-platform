import { AppError, ok, err } from "@snc/shared";
import type { Result } from "@snc/shared";

import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";
import { harborChannelPaths } from "./playout-topology.js";

// ── Types ──

export type LiquidsoapNowPlaying = {
  uri: string;
  title: string;
  /** Active source label returned by `switch.selected()` in the .liq render. */
  selected: string;
  elapsed: number;
  remaining: number;
};

// ── Interface ──

/**
 * Operations the queue orchestrator needs from Liquidsoap.
 *
 * B1 downgrade (2026-06-17): `setMode` and `setManualTier` are removed. Mode and
 * manual-pin are no longer live verbs — they apply via regenerate-and-restart in the
 * control service. The `/mode` and `/manual` harbor endpoints are not emitted in the
 * rendered .liq. `armQueue` is the only live editorial-control verb.
 */
export type LiquidsoapClient = {
  /** Push a track URI to a channel's request.queue for prefetch + playback. */
  pushTrack(channelId: string, uri: string): Promise<Result<void, AppError>>;
  /** Skip the current track on a channel. */
  skipTrack(channelId: string): Promise<Result<void, AppError>>;
  /** Fetch now-playing metadata for a channel. Returns null if unavailable. */
  getNowPlaying(channelId: string): Promise<LiquidsoapNowPlaying | null>;
  /**
   * Arm or disarm the channel queue for take-over.
   *
   * Calls the `?secret=`-guarded POST `/channels/{channelId}/arm` endpoint.
   * Returns err(LIQUIDSOAP_SECRET_NOT_CONFIGURED) when `PLAYOUT_CALLBACK_SECRET`
   * is unset.
   */
  armQueue(channelId: string, armed: boolean): Promise<Result<void, AppError>>;
};

// ── Real Implementation ──

const logger = rootLogger.child({ service: "liquidsoap-client" });

/**
 * Create a Liquidsoap client that calls per-channel harbor endpoints.
 * Endpoint pattern: POST /channels/{channelId}/queue, POST /channels/{channelId}/skip,
 * GET /channels/{channelId}/now-playing.
 *
 * The editorial control endpoints (mode, arm, manual) are `?secret=`-guarded: they
 * require `PLAYOUT_CALLBACK_SECRET` to be set. When the secret is absent the client
 * returns err(LIQUIDSOAP_SECRET_NOT_CONFIGURED) immediately rather than making a call
 * that would 401 — the secret is a deployment invariant, not a runtime condition, so
 * failing fast with a clear code is preferable to surfacing an opaque 401.
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

  /**
   * POST to a `?secret=`-guarded harbor endpoint.
   *
   * Returns err(LIQUIDSOAP_SECRET_NOT_CONFIGURED) immediately when
   * `PLAYOUT_CALLBACK_SECRET` is unset, avoiding a guaranteed 401.
   */
  const requestGuarded = (
    path: string,
    body: string,
  ): Promise<Result<void, AppError>> => {
    const secret = config.PLAYOUT_CALLBACK_SECRET;
    if (!secret) {
      return Promise.resolve(
        err(
          new AppError(
            "LIQUIDSOAP_SECRET_NOT_CONFIGURED",
            "PLAYOUT_CALLBACK_SECRET is not configured",
            503,
          ),
        ),
      );
    }
    return request(`${path}?secret=${encodeURIComponent(secret)}`, {
      method: "POST",
      body,
      headers: { "Content-Type": "text/plain" },
    });
  };

  return {
    async pushTrack(channelId, uri) {
      const annotatedUri = `annotate:s3_uri="${uri}":${uri}`;
      return request(harborChannelPaths(channelId).queue, {
        method: "POST",
        body: annotatedUri,
        headers: { "Content-Type": "text/plain" },
      });
    },

    async skipTrack(channelId) {
      return request(harborChannelPaths(channelId).skip, { method: "POST" });
    },

    async getNowPlaying(channelId) {
      if (!baseUrl) return null;
      try {
        const res = await fetch(`${baseUrl}${harborChannelPaths(channelId).nowPlaying}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return null;
        return (await res.json()) as LiquidsoapNowPlaying;
      } catch {
        return null;
      }
    },

    async armQueue(channelId, armed) {
      return requestGuarded(harborChannelPaths(channelId).arm, armed ? "true" : "false");
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
  async armQueue(channelId, armed) {
    logger.info({ channelId, armed }, "STUB: armQueue");
    return ok(undefined);
  },
});
