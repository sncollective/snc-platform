import { desc, eq } from "drizzle-orm";

import { db } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { streamSessions } from "../db/schema/streaming.schema.js";
import { rootLogger } from "../logging/logger.js";
import { activateLiveChannel, deactivateLiveChannel } from "./channels.js";
import { ensureChannelRoom } from "./chat.js";
import { broadcastToRoom } from "./chat-rooms.js";

// ── Private Helpers ──

const toErrorDetail = (e: unknown) => ({ error: e instanceof Error ? e.message : String(e) });

// ── Public API ──

/** Extract the `key=` query parameter value from an SRS callback `param` string. */
export const extractStreamKey = (param: string): string | null => {
  const match = param.match(/[?&]key=([^&]*)/);
  return match?.[1] ?? null;
};

/**
 * Activate a creator's persistent channel and ensure its chat room exists
 * when a creator starts streaming.
 *
 * The channel row must already exist (provisioned at stream-key creation via
 * `ensureCreatorChannel`).  This call activates the existing row — it never
 * inserts a new channel.  The chat room is ensured idempotently so it
 * survives across publish/unpublish cycles; the same room is reused for each
 * session.
 *
 * Best-effort and fire-and-forget by contract: every failure is logged and
 * swallowed so the SRS `on_publish` callback is never blocked. Returns void —
 * callers must not branch on success.
 */
export async function ensureLiveChannelWithChat(
  creatorId: string,
  sessionId: string,
  srsStreamName: string,
): Promise<void> {
  try {
    const [profile] = await db
      .select({ displayName: creatorProfiles.displayName })
      .from(creatorProfiles)
      .where(eq(creatorProfiles.id, creatorId));

    if (!profile) return;

    const channelResult = await activateLiveChannel({
      creatorId,
      creatorName: profile.displayName,
      streamSessionId: sessionId,
      srsStreamName,
    });

    if (!channelResult.ok) return;

    try {
      // ensureChannelRoom is idempotent — reuses the room across sessions
      // rather than creating a new one each time.
      await ensureChannelRoom(
        channelResult.value.channelId,
        `${profile.displayName}'s Stream`,
      );
    } catch (chatErr) {
      rootLogger.error(toErrorDetail(chatErr), "Failed to ensure channel chat room");
    }
  } catch (channelErr) {
    rootLogger.error(toErrorDetail(channelErr), "Failed to activate live channel");
  }
}

/**
 * Deactivate a creator's persistent channel when streaming stops.
 *
 * Deactivates the channel row (`isActive: false`) without deleting it —
 * the persistent row and its chat room survive across sessions.  The chat
 * room is NOT closed here; it remains open so viewers can continue chatting
 * between sessions.  The room_closed event is only emitted to current
 * viewers to cue them that the stream ended.
 *
 * Best-effort and fire-and-forget by contract: every failure is logged and
 * swallowed so the SRS `on_unpublish` callback is never blocked. Returns void —
 * callers must not branch on success.
 */
export async function teardownLiveChannel(srsClientId: string): Promise<void> {
  try {
    const closedSession = await db
      .select({ id: streamSessions.id })
      .from(streamSessions)
      .where(eq(streamSessions.srsClientId, srsClientId))
      .orderBy(desc(streamSessions.endedAt))
      .limit(1);

    if (closedSession.length === 0) return;

    const sessionId = closedSession[0]!.id;
    const channelResult = await deactivateLiveChannel(sessionId);

    if (!channelResult.ok || !channelResult.value) return;

    const { channelId } = channelResult.value;
    // Notify current viewers the stream ended, but do NOT close the room —
    // the persistent channel room survives across sessions.
    broadcastToRoom(channelId, {
      type: "room_closed",
      roomId: channelId,
    });
  } catch (channelErr) {
    rootLogger.error(toErrorDetail(channelErr), "Failed to deactivate live channel");
  }
}
