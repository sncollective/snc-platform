import { and, eq } from "drizzle-orm";

import { config } from "../config.js";
import { db } from "../db/connection.js";
import { channels } from "../db/schema/streaming.schema.js";
import { rootLogger } from "../logging/logger.js";

import type { LiquidsoapNowPlaying } from "./liquidsoap-client.js";

const logger = rootLogger.child({ service: "liquidsoap" });

/**
 * Resolve the broadcast channel's id (S/NC TV — ownership=platform, role=broadcast).
 * Returns null when no broadcast channel exists (e.g. an un-seeded environment).
 */
const getBroadcastChannelId = async (): Promise<string | null> => {
  const [row] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.ownership, "platform"), eq(channels.role, "broadcast")));
  return row?.id ?? null;
};

// ── Public API ──

/**
 * Fetch now-playing metadata for the S/NC TV broadcast channel from Liquidsoap's
 * harbor HTTP API.
 *
 * S/NC TV is now an ordinary generated channel (snctv-composition), so this reads the
 * per-channel `/channels/<broadcastId>/now-playing` endpoint — which is `switch.selected()`-
 * based and returns a superset of the legacy shape (adds `selected`, which we ignore here).
 * The legacy `/now-playing` broadcast-only endpoint is gone.
 *
 * Returns null if Liquidsoap is unreachable/unconfigured or no broadcast channel is seeded.
 */
export const getNowPlaying = async (): Promise<LiquidsoapNowPlaying | null> => {
  if (!config.LIQUIDSOAP_API_URL) return null;

  const broadcastId = await getBroadcastChannelId();
  if (!broadcastId) return null;

  try {
    const res = await fetch(
      `${config.LIQUIDSOAP_API_URL}/channels/${broadcastId}/now-playing`,
      { signal: AbortSignal.timeout(3000) },
    );
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
