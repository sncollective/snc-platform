import { and, eq, inArray, sql } from "drizzle-orm";
import { AppError, ForbiddenError, NotFoundError, err, ok } from "@snc/shared";
import type { PlayoutQueueEntry, Result } from "@snc/shared";

import { db } from "../../db/connection.js";
import { content } from "../../db/schema/content.schema.js";
import {
  channelContent,
  playoutQueue,
} from "../../db/schema/playout-queue.schema.js";
import { playoutItems } from "../../db/schema/playout.schema.js";
import type { LiquidsoapClient } from "../liquidsoap-client.js";
import {
  enqueue,
  markPlayed,
  promoteNext,
  removeQueued,
} from "../playout-queue-transitions.js";
import type { QueueSource } from "../playout-queue-transitions.js";
import { autoFill, queueDepthBelowAutoFillThreshold } from "./auto-fill.js";
import { resolvePoolScope } from "./pool-scope.js";
import { pushPrefetchBuffer } from "./prefetch.js";
import { toQueueEntry } from "./queue-projections.js";

export type QueueControlLogger = {
  info: (bindings: Record<string, unknown>, message: string) => void;
  warn: (bindings: Record<string, unknown>, message: string) => void;
  debug: (bindings: Record<string, unknown>, message: string) => void;
};

/** Handle a track-started event from Liquidsoap and advance the channel queue. */
export const onTrackStarted = async (
  channelId: string,
  uri: string,
  client: LiquidsoapClient,
  logger: QueueControlLogger,
): Promise<Result<void, AppError>> => {
  logger.info({ channelId, uri }, "Track started event received");

  const [playing] = await db
    .select()
    .from(playoutQueue)
    .where(
      and(
        eq(playoutQueue.channelId, channelId),
        eq(playoutQueue.status, "playing"),
      ),
    );

  if (playing) {
    await markPlayed(playing.id, playing.channelId);

    const poolMatch = playing.playoutItemId
      ? eq(channelContent.playoutItemId, playing.playoutItemId)
      : eq(channelContent.contentId, playing.contentId!);

    await db
      .update(channelContent)
      .set({
        lastPlayedAt: new Date(),
        playCount: sql`${channelContent.playCount} + 1`,
      })
      .where(and(eq(channelContent.channelId, channelId), poolMatch));
  }

  await promoteNext(channelId);

  if (await queueDepthBelowAutoFillThreshold(channelId)) {
    await autoFill(channelId, logger);
  }

  await pushPrefetchBuffer(channelId, client, logger);

  return ok(undefined);
};

/** Insert an item into the queue at a given position (default: end). */
export const insertIntoQueue = async (
  channelId: string,
  source: QueueSource,
  position: number | undefined,
  client: LiquidsoapClient,
  logger: QueueControlLogger,
): Promise<Result<PlayoutQueueEntry, AppError>> => {
  const scopeResult = await resolvePoolScope(channelId);
  if (!scopeResult.ok) return scopeResult;
  const scope = scopeResult.value;

  const isPlayoutSource = "playoutItemId" in source;
  const sourceId = isPlayoutSource ? source.playoutItemId : source.contentId;

  if ("creatorId" in scope) {
    const poolRows = isPlayoutSource
      ? ((await db.execute(sql`
          SELECT 1
          FROM channel_content
          WHERE channel_id = ${channelId}
            AND playout_item_id = ${sourceId}
        `)) as Array<unknown>)
      : ((await db.execute(sql`
          SELECT 1
          FROM channel_content
          WHERE channel_id = ${channelId}
            AND content_id = ${sourceId}
        `)) as Array<unknown>);

    const inPool = Array.isArray(poolRows) && poolRows.length > 0;
    if (!inPool) {
      logger.warn(
        { channelId, creatorId: scope.creatorId, sourceId, isPlayoutSource },
        "Rejected creator queue insert — source not in channel's scoped pool",
      );
      return err(
        new ForbiddenError(
          "Item is not in this channel's content pool",
        ),
      );
    }
  }

  let title: string | null;
  let duration: number | null;
  let sourceType: "playout" | "content";
  if (isPlayoutSource) {
    const [item] = await db
      .select()
      .from(playoutItems)
      .where(eq(playoutItems.id, sourceId));
    if (!item) {
      return err(new NotFoundError("Playout item not found"));
    }
    title = item.title;
    duration = item.duration;
    sourceType = "playout";
  } else {
    const [item] = await db
      .select()
      .from(content)
      .where(eq(content.id, sourceId));
    if (!item) {
      return err(new NotFoundError("Content not found"));
    }
    title = item.title;
    duration = item.duration;
    sourceType = "content";
  }

  const row = await enqueue({
    channelId,
    source,
    ...(position !== undefined ? { position } : {}),
  });

  if (!row) {
    return err(new AppError("INSERT_FAILED", "Failed to insert queue entry", 500));
  }

  await pushPrefetchBuffer(channelId, client, logger);

  return ok(toQueueEntry({ ...row, sourceType, title, duration }));
};

/** Remove a queued item. Cannot remove the currently playing item. */
export const removeFromQueue = async (
  channelId: string,
  queueEntryId: string,
): Promise<Result<void, AppError>> => {
  const [entry] = await db
    .select()
    .from(playoutQueue)
    .where(
      and(
        eq(playoutQueue.id, queueEntryId),
        eq(playoutQueue.channelId, channelId),
      ),
    );

  if (!entry) {
    return err(new NotFoundError("Queue entry not found"));
  }

  return removeQueued(entry);
};

/** Skip the current track. Marks as played and advances queue. */
export const skip = async (
  channelId: string,
  client: LiquidsoapClient,
  logger: QueueControlLogger,
): Promise<Result<void, AppError>> => {
  const [playing] = await db
    .select()
    .from(playoutQueue)
    .where(
      and(
        eq(playoutQueue.channelId, channelId),
        eq(playoutQueue.status, "playing"),
      ),
    );

  if (playing) {
    await markPlayed(playing.id, playing.channelId);
  }

  const skipResult = await client.skipTrack(channelId);
  if (!skipResult.ok) {
    logger.warn({ channelId, error: skipResult.error }, "Liquidsoap skipTrack failed");
  }

  await promoteNext(channelId);

  if (await queueDepthBelowAutoFillThreshold(channelId)) {
    await autoFill(channelId, logger);
  }

  await pushPrefetchBuffer(channelId, client, logger);

  return ok(undefined);
};
