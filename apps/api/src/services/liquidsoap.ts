import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";

import type { LiquidsoapNowPlaying } from "./liquidsoap-client.js";

const logger = rootLogger.child({ service: "liquidsoap" });

// ── Public API ──

/**
 * Fetch now-playing metadata from Liquidsoap's harbor HTTP API.
 * Uses the backward-compatible /now-playing endpoint (S/NC TV broadcast channel).
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
