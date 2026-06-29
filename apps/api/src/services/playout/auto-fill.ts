import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { playoutQueue } from "../../db/schema/playout-queue.schema.js";
import { enqueueBatch } from "../playout-queue-transitions.js";
import type { QueueSource } from "../playout-queue-transitions.js";
import { resolvePoolScope } from "./pool-scope.js";

const AUTO_FILL_THRESHOLD = 5;
const AUTO_FILL_BATCH = 10;

export type AutoFillLogger = {
  debug: (bindings: Record<string, unknown>, message: string) => void;
  info: (bindings: Record<string, unknown>, message: string) => void;
};

/**
 * Fill the queue from the content pool when below threshold.
 * Selection: weighted random favoring least-recently-played items.
 * Items already in the queue (queued or playing) are excluded.
 */
export const autoFill = async (
  channelId: string,
  logger: AutoFillLogger,
): Promise<void> => {
  const [depthResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playoutQueue)
    .where(
      and(
        eq(playoutQueue.channelId, channelId),
        inArray(playoutQueue.status, ["queued", "playing"]),
      ),
    );

  const depth = depthResult?.count ?? 0;
  if (depth >= AUTO_FILL_THRESHOLD) {
    return;
  }

  const needed = AUTO_FILL_BATCH - depth;

  const autoFillScopeResult = await resolvePoolScope(channelId);
  if (!autoFillScopeResult.ok) {
    logger.debug({ channelId }, "Auto-fill: channel not found, skipping");
    return;
  }
  const autoFillScope = autoFillScopeResult.value;
  const autoFillCreatorScoped = "creatorId" in autoFillScope;

  const autoFillPlayoutArm = autoFillCreatorScoped
    ? sql``
    : sql`
      SELECT cc.id, 'playout' AS source_type, cc.playout_item_id AS source_id, cc.last_played_at, cc.play_count
      FROM channel_content cc
      JOIN playout_items pi ON pi.id = cc.playout_item_id
      WHERE cc.channel_id = ${channelId}
        AND cc.playout_item_id IS NOT NULL
        AND pi.processing_status = 'ready'
        AND cc.playout_item_id NOT IN (
          SELECT playout_item_id FROM playout_queue
          WHERE channel_id = ${channelId}
            AND status IN ('queued', 'playing')
            AND playout_item_id IS NOT NULL
        )

      UNION ALL
`;

  const autoFillContentOwnershipFilter = autoFillCreatorScoped
    ? sql`AND c.creator_id = ${autoFillScope.creatorId}
        AND c.deleted_at IS NULL`
    : sql``;

  const candidateRows = (await db.execute(sql`
    SELECT * FROM (${autoFillPlayoutArm}
      SELECT cc.id, 'content' AS source_type, cc.content_id AS source_id, cc.last_played_at, cc.play_count
      FROM channel_content cc
      JOIN content c ON c.id = cc.content_id
      WHERE cc.channel_id = ${channelId}
        AND cc.content_id IS NOT NULL
        AND (c.processing_status = 'ready' OR c.processing_status IS NULL)
        AND c.type = 'video'
        ${autoFillContentOwnershipFilter}
        AND cc.content_id NOT IN (
          SELECT content_id FROM playout_queue
          WHERE channel_id = ${channelId}
            AND status IN ('queued', 'playing')
            AND content_id IS NOT NULL
        )
    ) candidates
    ORDER BY
      last_played_at ASC NULLS FIRST,
      play_count ASC,
      random()
    LIMIT ${needed}
  `)) as Array<{ source_type: "playout" | "content"; source_id: string }>;

  if (candidateRows.length === 0) {
    logger.debug({ channelId }, "Auto-fill: no candidates in content pool");
    return;
  }

  const sources: QueueSource[] = candidateRows.map((r) =>
    r.source_type === "playout"
      ? { playoutItemId: r.source_id }
      : { contentId: r.source_id },
  );

  const added = await enqueueBatch(channelId, sources);

  logger.info(
    { channelId, added },
    "Auto-fill: added items to queue",
  );
};

/** Check whether a channel queue is below the auto-fill trigger depth. */
export const queueDepthBelowAutoFillThreshold = async (
  channelId: string,
): Promise<boolean> => {
  const [depthResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playoutQueue)
    .where(
      and(
        eq(playoutQueue.channelId, channelId),
        inArray(playoutQueue.status, ["queued", "playing"]),
      ),
    );

  return (depthResult?.count ?? 0) < AUTO_FILL_THRESHOLD;
};
