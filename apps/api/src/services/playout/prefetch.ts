import { and, asc, eq, inArray } from "drizzle-orm";

import { config } from "../../config.js";
import { db } from "../../db/connection.js";
import { content } from "../../db/schema/content.schema.js";
import { playoutQueue } from "../../db/schema/playout-queue.schema.js";
import { playoutItems } from "../../db/schema/playout.schema.js";
import type { LiquidsoapClient } from "../liquidsoap-client.js";
import { selectPlayoutRenditionUri } from "../playout-utils.js";

export type PlayoutOrchestratorLogger = {
  warn: (bindings: Record<string, unknown>, message: string) => void;
};

const PREFETCH_DEPTH = 3;

/** Resolve the best playable S3 URI for a channel_content or queue entry source. */
const resolveContentUri = async (
  entry: { playoutItemId: string | null; contentId: string | null },
): Promise<string | null> => {
  if (entry.playoutItemId) {
    const [item] = await db
      .select()
      .from(playoutItems)
      .where(eq(playoutItems.id, entry.playoutItemId));
    return item ? selectPlayoutRenditionUri(item) : null;
  }
  if (entry.contentId) {
    const [item] = await db
      .select()
      .from(content)
      .where(eq(content.id, entry.contentId));
    if (!item) return null;
    const key = item.transcodedMediaKey ?? item.mediaKey;
    return key ? `s3://${config.S3_BUCKET ?? "snc-storage"}/${key}` : null;
  }
  return null;
};

/** Push unpushed queue items to Liquidsoap up to the prefetch depth. */
export const pushPrefetchBuffer = async (
  channelId: string,
  client: LiquidsoapClient,
  logger: PlayoutOrchestratorLogger,
): Promise<void> => {
  const unpushed = await db
    .select({
      id: playoutQueue.id,
      playoutItemId: playoutQueue.playoutItemId,
      contentId: playoutQueue.contentId,
      position: playoutQueue.position,
    })
    .from(playoutQueue)
    .where(
      and(
        eq(playoutQueue.channelId, channelId),
        inArray(playoutQueue.status, ["queued", "playing"]),
        eq(playoutQueue.pushedToLiquidsoap, false),
      ),
    )
    .orderBy(asc(playoutQueue.position))
    .limit(PREFETCH_DEPTH);

  for (const entry of unpushed) {
    const uri = await resolveContentUri({
      playoutItemId: entry.playoutItemId ?? null,
      contentId: entry.contentId ?? null,
    });
    if (!uri) continue;

    const result = await client.pushTrack(channelId, uri);
    if (result.ok) {
      await db
        .update(playoutQueue)
        .set({ pushedToLiquidsoap: true })
        .where(eq(playoutQueue.id, entry.id));
    } else {
      logger.warn(
        { channelId, entryId: entry.id, error: result.error },
        "Failed to push track to Liquidsoap",
      );
    }
  }
};
