import { AppError, ok, err } from "@snc/shared";
import type { Result } from "@snc/shared";

import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";

const logger = rootLogger.child({ service: "liquidsoap" });

// ── Private Helpers ──

/** Guard that returns an error Result when Liquidsoap is not configured. */
const ensureLiquidsoapConfigured = (): Result<void, AppError> => {
  if (!config.LIQUIDSOAP_API_URL) {
    return err(new AppError("LIQUIDSOAP_NOT_CONFIGURED", "Liquidsoap is not configured", 503));
  }
  return ok(undefined);
};

/** Perform a Liquidsoap API request: config guard, fetch, status check, and error wrapping. */
const liquidsoapRequest = async (
  path: string,
  init?: RequestInit,
): Promise<Result<void, AppError>> => {
  const configured = ensureLiquidsoapConfigured();
  if (!configured.ok) return configured;

  try {
    const res = await fetch(`${config.LIQUIDSOAP_API_URL}${path}`, {
      signal: AbortSignal.timeout(3000),
      ...init,
    });
    if (!res.ok) {
      return err(new AppError("LIQUIDSOAP_ERROR", `Liquidsoap request failed: ${res.status}`, 502));
    }
    return ok(undefined);
  } catch (e) {
    return err(new AppError("LIQUIDSOAP_ERROR", "Liquidsoap unreachable", 502));
  }
};

// ── Types ──

export type LiquidsoapNowPlaying = {
  uri: string;
  title: string;
  elapsed: number;
  remaining: number;
};

// ── Public API ──

/**
 * Fetch now-playing metadata from Liquidsoap's harbor HTTP API.
 * Returns null if Liquidsoap is unreachable or not configured.
 */
export const getNowPlaying = async (): Promise<LiquidsoapNowPlaying | null> => {
  if (!config.LIQUIDSOAP_API_URL) return null;

  try {
    const res = await fetch(`${config.LIQUIDSOAP_API_URL}/now-playing`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      uri: string;
      title: string;
      elapsed: number;
      remaining: number;
    };

    return {
      uri: data.uri,
      title: data.title,
      elapsed: data.elapsed,
      remaining: data.remaining,
    };
  } catch (e) {
    logger.debug({ error: e instanceof Error ? e.message : String(e) }, "Liquidsoap unreachable");
    return null;
  }
};

/**
 * Skip the currently playing track. Liquidsoap advances to the next track
 * in the fallback chain (queue > playlist).
 */
export const skipTrack = async (): Promise<Result<void, AppError>> => {
  return liquidsoapRequest("/skip", { method: "POST" });
};

/**
 * Queue a specific S3 URI to play next. The queued item takes priority
 * over the playlist but yields to live streams.
 */
export const queueTrack = async (s3Uri: string): Promise<Result<void, AppError>> => {
  return liquidsoapRequest("/queue", {
    method: "POST",
    body: s3Uri,
    headers: { "Content-Type": "text/plain" },
  });
};
