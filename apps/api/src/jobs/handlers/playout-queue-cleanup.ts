import { and, eq, notInArray, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { playoutQueue } from "../../db/schema/playout-queue.schema.js";
import { rootLogger } from "../../logging/logger.js";

// ── Constants ──

/** Maximum number of `played` rows to retain per channel. Older rows are deleted. */
const HISTORY_CAP_PER_CHANNEL = 100;

// ── Public API ──

/**
 * Enforce the per-channel cap on `played` row history in playout_queue.
 *
 * For each playout channel, keeps the most recent `HISTORY_CAP_PER_CHANNEL` played
 * rows (by position DESC) and deletes the rest. Idempotent — safe to call repeatedly.
 * Returns the total number of rows deleted across all channels.
 *
 * Intended to run as a periodic job (every hour).
 */
export const handlePlayoutQueueCleanup = async (): Promise<number> => {
  // Find every channel_id that has at least one played row. No point processing
  // channels with no history. Using a raw sql select because there's no need to
  // join channels — distinct channel_ids from playout_queue is sufficient.
  const channelRows = await db
    .selectDistinct({ channelId: playoutQueue.channelId })
    .from(playoutQueue)
    .where(eq(playoutQueue.status, "played"));

  let totalDeleted = 0;

  for (const { channelId } of channelRows) {
    // Subquery: find the ids of the N most recent played rows to KEEP.
    // Then delete any other played row for this channel.
    const keepIds = db
      .select({ id: playoutQueue.id })
      .from(playoutQueue)
      .where(
        and(
          eq(playoutQueue.channelId, channelId),
          eq(playoutQueue.status, "played"),
        ),
      )
      .orderBy(sql`${playoutQueue.position} DESC`)
      .limit(HISTORY_CAP_PER_CHANNEL);

    const deleted = await db
      .delete(playoutQueue)
      .where(
        and(
          eq(playoutQueue.channelId, channelId),
          eq(playoutQueue.status, "played"),
          notInArray(playoutQueue.id, keepIds),
        ),
      )
      .returning({ id: playoutQueue.id });

    totalDeleted += deleted.length;
  }

  if (totalDeleted > 0) {
    rootLogger.info(
      {
        totalDeleted,
        channelCount: channelRows.length,
        capPerChannel: HISTORY_CAP_PER_CHANNEL,
      },
      "Playout queue cleanup completed",
    );
  }

  return totalDeleted;
};
