import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { NotFoundError, err, ok } from "@snc/shared";
import type { AppError, ChannelQueueStatus, Result } from "@snc/shared";

import { db } from "../../db/connection.js";
import { content } from "../../db/schema/content.schema.js";
import {
  channelContent,
  playoutQueue,
} from "../../db/schema/playout-queue.schema.js";
import { playoutItems } from "../../db/schema/playout.schema.js";
import { channels } from "../../db/schema/streaming.schema.js";
import {
  QUEUE_STATUS_COLUMNS,
  toQueueEntry,
} from "./queue-projections.js";

/** Get the current queue status for a channel. */
export const getChannelQueueStatus = async (
  channelId: string,
): Promise<Result<ChannelQueueStatus, AppError>> => {
  const [channel] = await db
    .select()
    .from(channels)
    .where(eq(channels.id, channelId));

  if (!channel) {
    return err(new NotFoundError("Channel not found"));
  }

  const [queueRows, [poolCount]] = await Promise.all([
    db
      .select(QUEUE_STATUS_COLUMNS)
      .from(playoutQueue)
      .leftJoin(playoutItems, eq(playoutQueue.playoutItemId, playoutItems.id))
      .leftJoin(content, eq(playoutQueue.contentId, content.id))
      .where(
        and(
          eq(playoutQueue.channelId, channelId),
          inArray(playoutQueue.status, ["queued", "playing"]),
        ),
      )
      .orderBy(asc(playoutQueue.position)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(channelContent)
      .where(eq(channelContent.channelId, channelId)),
  ]);

  const nowPlaying =
    queueRows.find((r) => r.status === "playing") ?? null;
  const upcoming = queueRows.filter((r) => r.status === "queued");

  return ok({
    channelId,
    channelName: channel.name,
    nowPlaying: nowPlaying ? toQueueEntry(nowPlaying) : null,
    upcoming: upcoming.map(toQueueEntry),
    poolSize: poolCount?.count ?? 0,
  });
};

/** Batch-fetch queue status for multiple channels in two queries instead of 3×N. */
export const getMultiChannelQueueStatus = async (
  channelIds: string[],
): Promise<Map<string, ChannelQueueStatus>> => {
  const result = new Map<string, ChannelQueueStatus>();
  if (channelIds.length === 0) return result;

  const [channelRows, queueRows, poolCounts] = await Promise.all([
    db
      .select({ id: channels.id, name: channels.name })
      .from(channels)
      .where(inArray(channels.id, channelIds)),
    db
      .select(QUEUE_STATUS_COLUMNS)
      .from(playoutQueue)
      .leftJoin(playoutItems, eq(playoutQueue.playoutItemId, playoutItems.id))
      .leftJoin(content, eq(playoutQueue.contentId, content.id))
      .where(
        and(
          inArray(playoutQueue.channelId, channelIds),
          inArray(playoutQueue.status, ["queued", "playing"]),
        ),
      )
      .orderBy(asc(playoutQueue.position)),
    db
      .select({
        channelId: channelContent.channelId,
        count: sql<number>`count(*)::int`,
      })
      .from(channelContent)
      .where(inArray(channelContent.channelId, channelIds))
      .groupBy(channelContent.channelId),
  ]);

  const channelNameMap = new Map(channelRows.map((r) => [r.id, r.name]));
  const poolCountMap = new Map(poolCounts.map((r) => [r.channelId, r.count]));

  const queueByChannel = new Map<string, typeof queueRows>();
  for (const row of queueRows) {
    let arr = queueByChannel.get(row.channelId);
    if (!arr) {
      arr = [];
      queueByChannel.set(row.channelId, arr);
    }
    arr.push(row);
  }

  for (const channelId of channelIds) {
    const name = channelNameMap.get(channelId);
    if (!name) continue;

    const rows = queueByChannel.get(channelId) ?? [];
    const nowPlaying = rows.find((r) => r.status === "playing") ?? null;
    const upcoming = rows.filter((r) => r.status === "queued");

    result.set(channelId, {
      channelId,
      channelName: name,
      nowPlaying: nowPlaying ? toQueueEntry(nowPlaying) : null,
      upcoming: upcoming.map(toQueueEntry),
      poolSize: poolCountMap.get(channelId) ?? 0,
    });
  }

  return result;
};
