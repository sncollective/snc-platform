import { desc, eq } from "drizzle-orm";

import { db } from "../db/connection.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { streamSessions } from "../db/schema/streaming.schema.js";
import { rootLogger } from "../logging/logger.js";
import { createLiveChannel, deactivateLiveChannel } from "./channels.js";
import { createChannelRoom, closeChannelRoom } from "./chat.js";
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
 * Provision a live channel and its chat room when a creator starts streaming.
 *
 * Best-effort and fire-and-forget by contract: every failure is logged and
 * swallowed so the SRS `on_publish` callback is never blocked. Returns void —
 * callers must not branch on success. (This is why it does not return a
 * `Result`: a recoverable error path here would change the SRS callback's
 * behavior, which must stay non-blocking.)
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

    const channelResult = await createLiveChannel({
      creatorId,
      creatorName: profile.displayName,
      streamSessionId: sessionId,
      srsStreamName,
    });

    if (!channelResult.ok) return;

    try {
      await createChannelRoom(
        channelResult.value.channelId,
        `${profile.displayName}'s Stream`,
      );
    } catch (chatErr) {
      rootLogger.error(toErrorDetail(chatErr), "Failed to create channel chat room");
    }
  } catch (channelErr) {
    rootLogger.error(toErrorDetail(channelErr), "Failed to create live channel");
  }
}

/**
 * Tear down a creator's live channel and close its chat room when streaming stops.
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
    try {
      await closeChannelRoom(channelId);
      broadcastToRoom(channelId, {
        type: "room_closed",
        roomId: channelId,
      });
    } catch (chatErr) {
      rootLogger.error(toErrorDetail(chatErr), "Failed to close channel chat room");
    }
  } catch (channelErr) {
    rootLogger.error(toErrorDetail(channelErr), "Failed to deactivate live channel");
  }
}
