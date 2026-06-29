import { sql } from "drizzle-orm";
import type {
  ChannelContent,
  PlayoutProcessingStatus,
  PlayoutQueueEntry,
} from "@snc/shared";

import { content } from "../../db/schema/content.schema.js";
import {
  channelContent,
  playoutQueue,
} from "../../db/schema/playout-queue.schema.js";
import { playoutItems } from "../../db/schema/playout.schema.js";

/**
 * Column projection for queue-status reads. The queue is source-polymorphic
 * (`playout_item_id` XOR `content_id`), so reads LEFT JOIN both source tables
 * and coalesce the display fields from whichever side is set.
 */
export const QUEUE_STATUS_COLUMNS = {
  id: playoutQueue.id,
  channelId: playoutQueue.channelId,
  playoutItemId: playoutQueue.playoutItemId,
  contentId: playoutQueue.contentId,
  position: playoutQueue.position,
  status: playoutQueue.status,
  pushedToLiquidsoap: playoutQueue.pushedToLiquidsoap,
  createdAt: playoutQueue.createdAt,
  sourceType:
    sql<"playout" | "content">`CASE WHEN ${playoutQueue.playoutItemId} IS NOT NULL THEN 'playout' ELSE 'content' END`.as(
      "sourceType",
    ),
  title: sql<string | null>`coalesce(${playoutItems.title}, ${content.title})`.as(
    "title",
  ),
  duration:
    sql<number | null>`coalesce(${playoutItems.duration}, ${content.duration})`.as(
      "duration",
    ),
} as const;

export type QueueStatusRow = typeof playoutQueue.$inferSelect & {
  sourceType: "playout" | "content";
  title: string | null;
  duration: number | null;
};

export const toQueueEntry = (row: QueueStatusRow): PlayoutQueueEntry => ({
  id: row.id,
  channelId: row.channelId,
  playoutItemId: row.playoutItemId ?? null,
  contentId: row.contentId ?? null,
  sourceType: row.sourceType,
  position: row.position,
  status: row.status as PlayoutQueueEntry["status"],
  pushedToLiquidsoap: row.pushedToLiquidsoap,
  createdAt: row.createdAt.toISOString(),
  title: row.title,
  duration: row.duration,
});

export type ChannelContentSqlRow = typeof channelContent.$inferSelect & {
  sourceType: "playout" | "content";
  title: string | null;
  duration: number | null;
  processingStatus: PlayoutProcessingStatus | null;
};

export const toChannelContent = (row: ChannelContentSqlRow): ChannelContent => ({
  id: row.id,
  channelId: row.channelId,
  playoutItemId: row.playoutItemId ?? null,
  contentId: row.contentId ?? null,
  sourceType: row.sourceType,
  processingStatus: row.processingStatus,
  title: row.title,
  duration: row.duration,
  lastPlayedAt: row.lastPlayedAt?.toISOString() ?? null,
  playCount: row.playCount,
  createdAt: row.createdAt instanceof Date
    ? row.createdAt.toISOString()
    : String(row.createdAt),
});
