import { randomUUID } from "node:crypto";

import { eq, and, asc, sql, inArray, gt, gte } from "drizzle-orm";
import { AppError, NotFoundError, ok, err } from "@snc/shared";
import type {
  Result,
  PlayoutQueueEntry,
  ChannelQueueStatus,
  ChannelContent,
  PoolCandidate,
  PlayoutProcessingStatus,
} from "@snc/shared";

import { db } from "../db/connection.js";
import {
  channelContent,
  playoutQueue,
} from "../db/schema/playout-queue.schema.js";
import { playoutItems } from "../db/schema/playout.schema.js";
import { content } from "../db/schema/content.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { channels } from "../db/schema/streaming.schema.js";
import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";
import { selectPlayoutRenditionUri } from "./playout-utils.js";
import type { LiquidsoapClient } from "./liquidsoap-client.js";

// ── Constants ──

/** Number of tracks to keep prefetched ahead in the queue. */
const PREFETCH_DEPTH = 3;

/** Minimum queue depth before auto-fill triggers. */
const AUTO_FILL_THRESHOLD = 5;

/** Number of items to auto-fill when threshold is hit. */
const AUTO_FILL_BATCH = 10;

// ── Constructor ──

export type PlayoutOrchestrator = ReturnType<typeof createPlayoutOrchestrator>;

// ── Row → Response transformer ──

const toQueueEntry = (
  row: typeof playoutQueue.$inferSelect & {
    title: string | null;
    duration: number | null;
  },
): PlayoutQueueEntry => ({
  id: row.id,
  channelId: row.channelId,
  playoutItemId: row.playoutItemId,
  position: row.position,
  status: row.status as PlayoutQueueEntry["status"],
  pushedToLiquidsoap: row.pushedToLiquidsoap,
  createdAt: row.createdAt.toISOString(),
  title: row.title,
  duration: row.duration,
});

const toChannelContent = (
  row: typeof channelContent.$inferSelect & {
    sourceType: "playout" | "content";
    title: string | null;
    duration: number | null;
    processingStatus: ChannelContent["processingStatus"];
  },
): ChannelContent => ({
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
  createdAt: row.createdAt.toISOString(),
});

// ── URI Resolution ──

/**
 * Resolve the best playable S3 URI for a channel_content entry.
 * Checks playoutItemId first, then contentId. Returns null if neither resolves.
 */
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

/**
 * Create a playout orchestrator bound to a Liquidsoap client.
 * The orchestrator manages queue state per channel and pushes tracks
 * to Liquidsoap for prefetch.
 */
export const createPlayoutOrchestrator = (client: LiquidsoapClient) => {
  const logger = rootLogger.child({ service: "playout-orchestrator" });

  // ── Queue Status ──

  /** Get the current queue status for a channel. */
  const getChannelQueueStatus = async (
    channelId: string,
  ): Promise<Result<ChannelQueueStatus, AppError>> => {
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId));

    if (!channel) {
      return err(new NotFoundError("Channel not found"));
    }

    const queueRows = await db
      .select({
        id: playoutQueue.id,
        channelId: playoutQueue.channelId,
        playoutItemId: playoutQueue.playoutItemId,
        position: playoutQueue.position,
        status: playoutQueue.status,
        pushedToLiquidsoap: playoutQueue.pushedToLiquidsoap,
        createdAt: playoutQueue.createdAt,
        title: playoutItems.title,
        duration: playoutItems.duration,
      })
      .from(playoutQueue)
      .innerJoin(playoutItems, eq(playoutQueue.playoutItemId, playoutItems.id))
      .where(
        and(
          eq(playoutQueue.channelId, channelId),
          inArray(playoutQueue.status, ["queued", "playing"]),
        ),
      )
      .orderBy(asc(playoutQueue.position));

    const [poolCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(channelContent)
      .where(eq(channelContent.channelId, channelId));

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
  const getMultiChannelQueueStatus = async (
    channelIds: string[],
  ): Promise<Map<string, ChannelQueueStatus>> => {
    const result = new Map<string, ChannelQueueStatus>();
    if (channelIds.length === 0) return result;

    // Fetch channel names
    const channelRows = await db
      .select({ id: channels.id, name: channels.name })
      .from(channels)
      .where(inArray(channels.id, channelIds));

    const channelNameMap = new Map(channelRows.map((r) => [r.id, r.name]));

    // Single query: all queue rows across all channels
    const queueRows = await db
      .select({
        id: playoutQueue.id,
        channelId: playoutQueue.channelId,
        playoutItemId: playoutQueue.playoutItemId,
        position: playoutQueue.position,
        status: playoutQueue.status,
        pushedToLiquidsoap: playoutQueue.pushedToLiquidsoap,
        createdAt: playoutQueue.createdAt,
        title: playoutItems.title,
        duration: playoutItems.duration,
      })
      .from(playoutQueue)
      .innerJoin(playoutItems, eq(playoutQueue.playoutItemId, playoutItems.id))
      .where(
        and(
          inArray(playoutQueue.channelId, channelIds),
          inArray(playoutQueue.status, ["queued", "playing"]),
        ),
      )
      .orderBy(asc(playoutQueue.position));

    // Single query: pool counts grouped by channel
    const poolCounts = await db
      .select({
        channelId: channelContent.channelId,
        count: sql<number>`count(*)::int`,
      })
      .from(channelContent)
      .where(inArray(channelContent.channelId, channelIds))
      .groupBy(channelContent.channelId);

    const poolCountMap = new Map(poolCounts.map((r) => [r.channelId, r.count]));

    // Group queue rows by channel
    const queueByChannel = new Map<string, typeof queueRows>();
    for (const row of queueRows) {
      let arr = queueByChannel.get(row.channelId);
      if (!arr) {
        arr = [];
        queueByChannel.set(row.channelId, arr);
      }
      arr.push(row);
    }

    // Build result map — include every requested channel even if it has no queue entries
    for (const channelId of channelIds) {
      const name = channelNameMap.get(channelId);
      if (!name) continue; // channel not found in DB

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

  // ── Track Event ──

  /**
   * Handle a track-started event from Liquidsoap.
   * Advances the queue: marks current as played, promotes next to playing,
   * updates content pool stats, auto-fills if needed, pushes next track.
   */
  const onTrackStarted = async (
    channelId: string,
    uri: string,
  ): Promise<Result<void, AppError>> => {
    logger.info({ channelId, uri }, "Track started event received");

    // 1. Find currently playing entry for this channel
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
      // 2. Mark as played and update channel_content stats
      await db
        .update(playoutQueue)
        .set({ status: "played" })
        .where(eq(playoutQueue.id, playing.id));

      await db
        .update(channelContent)
        .set({
          lastPlayedAt: new Date(),
          playCount: sql`${channelContent.playCount} + 1`,
        })
        .where(
          and(
            eq(channelContent.channelId, channelId),
            eq(channelContent.playoutItemId, playing.playoutItemId),
          ),
        );
    }

    // 3. Promote next queued to playing
    const [next] = await db
      .select()
      .from(playoutQueue)
      .where(
        and(
          eq(playoutQueue.channelId, channelId),
          eq(playoutQueue.status, "queued"),
        ),
      )
      .orderBy(asc(playoutQueue.position))
      .limit(1);

    if (next) {
      await db
        .update(playoutQueue)
        .set({ status: "playing" })
        .where(eq(playoutQueue.id, next.id));
    }

    // 4. Check queue depth and auto-fill if needed
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
    if (depth < AUTO_FILL_THRESHOLD) {
      await autoFill(channelId);
    }

    // 5. Push next unpushed items to Liquidsoap
    await pushPrefetchBuffer(channelId);

    return ok(undefined);
  };

  // ── Admin Operations ──

  /**
   * Insert an item into the queue at a given position (default: end).
   * Shifts existing entries at >= position up by 1 when position is given.
   */
  const insertIntoQueue = async (
    channelId: string,
    playoutItemId: string,
    position?: number,
  ): Promise<Result<PlayoutQueueEntry, AppError>> => {
    // 1. Validate the playout item exists
    const [item] = await db
      .select()
      .from(playoutItems)
      .where(eq(playoutItems.id, playoutItemId));

    if (!item) {
      return err(new NotFoundError("Playout item not found"));
    }

    // 2. Determine the insert position
    let insertPosition: number;
    if (position !== undefined) {
      // Shift existing queued entries at >= position up by 1
      await db
        .update(playoutQueue)
        .set({ position: sql`${playoutQueue.position} + 1` })
        .where(
          and(
            eq(playoutQueue.channelId, channelId),
            inArray(playoutQueue.status, ["queued"]),
            gte(playoutQueue.position, position),
          ),
        );
      insertPosition = position;
    } else {
      // Insert at end of queue
      const [maxRow] = await db
        .select({ max: sql<number | null>`MAX(${playoutQueue.position})` })
        .from(playoutQueue)
        .where(
          and(
            eq(playoutQueue.channelId, channelId),
            inArray(playoutQueue.status, ["queued", "playing"]),
          ),
        );
      insertPosition = (maxRow?.max ?? 0) + 1;
    }

    // 3. Create queue entry
    const id = randomUUID();
    const [row] = await db
      .insert(playoutQueue)
      .values({
        id,
        channelId,
        playoutItemId,
        position: insertPosition,
        status: "queued",
        pushedToLiquidsoap: false,
      })
      .returning();

    if (!row) {
      return err(new AppError("INSERT_FAILED", "Failed to insert queue entry", 500));
    }

    // 4. Push prefetch buffer if within prefetch window
    await pushPrefetchBuffer(channelId);

    return ok(
      toQueueEntry({ ...row, title: item.title, duration: item.duration }),
    );
  };

  /**
   * Remove a queued item. Cannot remove the currently playing item.
   */
  const removeFromQueue = async (
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

    if (entry.status === "playing") {
      return err(
        new AppError(
          "CANNOT_REMOVE_PLAYING",
          "Cannot remove the currently playing item",
          409,
        ),
      );
    }

    await db
      .delete(playoutQueue)
      .where(eq(playoutQueue.id, queueEntryId));

    return ok(undefined);
  };

  /**
   * Skip the current track. Marks as played and advances queue.
   */
  const skip = async (
    channelId: string,
  ): Promise<Result<void, AppError>> => {
    // 1. Find playing entry and mark as played
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
      await db
        .update(playoutQueue)
        .set({ status: "played" })
        .where(eq(playoutQueue.id, playing.id));
    }

    // 2. Tell Liquidsoap to skip
    const skipResult = await client.skipTrack(channelId);
    if (!skipResult.ok) {
      logger.warn({ channelId, error: skipResult.error }, "Liquidsoap skipTrack failed");
    }

    // 3. Promote next queued entry to playing
    const [next] = await db
      .select()
      .from(playoutQueue)
      .where(
        and(
          eq(playoutQueue.channelId, channelId),
          eq(playoutQueue.status, "queued"),
        ),
      )
      .orderBy(asc(playoutQueue.position))
      .limit(1);

    if (next) {
      await db
        .update(playoutQueue)
        .set({ status: "playing" })
        .where(eq(playoutQueue.id, next.id));
    }

    // 4. Auto-fill and push prefetch if needed
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
    if (depth < AUTO_FILL_THRESHOLD) {
      await autoFill(channelId);
    }

    await pushPrefetchBuffer(channelId);

    return ok(undefined);
  };

  // ── Content Pool ──

  /**
   * Assign items to a channel's content pool.
   * Accepts playout item IDs and/or creator content IDs.
   * Ignores items already in the pool (upsert-ignore semantics).
   */
  const assignContent = async (
    channelId: string,
    playoutItemIds: string[],
    contentIds?: string[],
  ): Promise<Result<void, AppError>> => {
    const playoutValues = playoutItemIds.map((playoutItemId) => ({
      id: randomUUID(),
      channelId,
      playoutItemId,
      contentId: null,
    }));

    const contentValues = (contentIds ?? []).map((contentId) => ({
      id: randomUUID(),
      channelId,
      playoutItemId: null,
      contentId,
    }));

    const values = [...playoutValues, ...contentValues];
    if (values.length === 0) return ok(undefined);

    await db
      .insert(channelContent)
      .values(values)
      .onConflictDoNothing();

    return ok(undefined);
  };

  /**
   * Remove items from a channel's content pool.
   * Accepts playout item IDs and/or creator content IDs.
   * Does not affect queued items — only the pool entries are removed.
   */
  const removeContent = async (
    channelId: string,
    playoutItemIds: string[],
    contentIds?: string[],
  ): Promise<Result<void, AppError>> => {
    if (playoutItemIds.length > 0) {
      await db
        .delete(channelContent)
        .where(
          and(
            eq(channelContent.channelId, channelId),
            inArray(channelContent.playoutItemId, playoutItemIds),
          ),
        );
    }

    if ((contentIds ?? []).length > 0) {
      await db
        .delete(channelContent)
        .where(
          and(
            eq(channelContent.channelId, channelId),
            inArray(channelContent.contentId, contentIds!),
          ),
        );
    }

    return ok(undefined);
  };

  /** List content pool items for a channel, enriched with title, duration, and source type. */
  const listContent = async (
    channelId: string,
  ): Promise<Result<ChannelContent[], AppError>> => {
    // Use raw SQL to UNION results from both playout_items and content tables
    const rows = (await db.execute(sql`
      SELECT
        cc.id,
        cc.channel_id AS "channelId",
        cc.playout_item_id AS "playoutItemId",
        cc.content_id AS "contentId",
        'playout' AS "sourceType",
        pi.processing_status AS "processingStatus",
        pi.title,
        pi.duration,
        cc.last_played_at AS "lastPlayedAt",
        cc.play_count AS "playCount",
        cc.created_at AS "createdAt"
      FROM channel_content cc
      JOIN playout_items pi ON pi.id = cc.playout_item_id
      WHERE cc.channel_id = ${channelId}
        AND cc.playout_item_id IS NOT NULL

      UNION ALL

      SELECT
        cc.id,
        cc.channel_id AS "channelId",
        cc.playout_item_id AS "playoutItemId",
        cc.content_id AS "contentId",
        'content' AS "sourceType",
        NULL AS "processingStatus",
        c.title,
        c.duration,
        cc.last_played_at AS "lastPlayedAt",
        cc.play_count AS "playCount",
        cc.created_at AS "createdAt"
      FROM channel_content cc
      JOIN content c ON c.id = cc.content_id
      WHERE cc.channel_id = ${channelId}
        AND cc.content_id IS NOT NULL

      ORDER BY "createdAt" ASC
    `)) as Array<{
      id: string;
      channelId: string;
      playoutItemId: string | null;
      contentId: string | null;
      sourceType: "playout" | "content";
      processingStatus: string | null;
      title: string | null;
      duration: number | null;
      lastPlayedAt: Date | null;
      playCount: number;
      createdAt: Date;
    }>;

    return ok(
      rows.map((row) => ({
        id: row.id,
        channelId: row.channelId,
        playoutItemId: row.playoutItemId ?? null,
        contentId: row.contentId ?? null,
        sourceType: row.sourceType,
        processingStatus: (row.processingStatus as PlayoutProcessingStatus | null) ?? null,
        title: row.title,
        duration: row.duration ?? null,
        lastPlayedAt: row.lastPlayedAt?.toISOString() ?? null,
        playCount: row.playCount,
        createdAt: row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      })),
    );
  };

  // ── Auto-Fill ──

  /**
   * Fill the queue from the content pool when below threshold.
   * Selection: weighted random favoring least-recently-played items.
   * Items already in the queue (queued or playing) are excluded.
   */
  const autoFill = async (channelId: string): Promise<void> => {
    // Check current queue depth
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

    // Select from content pool (both playout items and creator content), excluding items already in queue.
    // ORDER BY: last_played_at ASC NULLS FIRST, play_count ASC, random()
    // Note: db.execute() with postgres-js returns rows directly as an array (not { rows: [...] })
    const candidateRows = (await db.execute(sql`
      SELECT * FROM (
        SELECT cc.id, cc.playout_item_id, cc.last_played_at, cc.play_count
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

        SELECT cc.id, cc.content_id AS playout_item_id, cc.last_played_at, cc.play_count
        FROM channel_content cc
        JOIN content c ON c.id = cc.content_id
        WHERE cc.channel_id = ${channelId}
          AND cc.content_id IS NOT NULL
          AND (c.processing_status = 'completed' OR c.processing_status IS NULL)
          AND c.type = 'video'
      ) candidates
      ORDER BY
        last_played_at ASC NULLS FIRST,
        play_count ASC,
        random()
      LIMIT ${needed}
    `)) as Array<{ playout_item_id: string }>;

    if (candidateRows.length === 0) {
      logger.debug({ channelId }, "Auto-fill: no candidates in content pool");
      return;
    }

    // Get the current max position in the queue
    const [maxRow] = await db
      .select({ max: sql<number | null>`MAX(${playoutQueue.position})` })
      .from(playoutQueue)
      .where(
        and(
          eq(playoutQueue.channelId, channelId),
          inArray(playoutQueue.status, ["queued", "playing"]),
        ),
      );

    let nextPosition = (maxRow?.max ?? 0) + 1;

    const newEntries = candidateRows.map(
      (row) => ({
        id: randomUUID(),
        channelId,
        playoutItemId: row.playout_item_id,
        position: nextPosition++,
        status: "queued" as const,
        pushedToLiquidsoap: false,
      }),
    );

    await db.insert(playoutQueue).values(newEntries);

    logger.info(
      { channelId, added: newEntries.length },
      "Auto-fill: added items to queue",
    );
  };

  // ── Push Prefetch Buffer ──

  /**
   * Push unpushed queue items to Liquidsoap up to PREFETCH_DEPTH.
   * Called after auto-fill, track events, and queue mutations.
   */
  const pushPrefetchBuffer = async (channelId: string): Promise<void> => {
    // Find items that need to be pushed (queued or playing, not yet pushed), up to PREFETCH_DEPTH
    const unpushed = await db
      .select({
        id: playoutQueue.id,
        playoutItemId: playoutQueue.playoutItemId,
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
        contentId: null,
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

  // ── Content Search ──

  /**
   * Search for items available to add to a channel's content pool.
   * Returns playout items and creator content not already in the pool.
   * Results are case-insensitively filtered by title, limited to 20.
   */
  const searchAvailableContent = async (
    channelId: string,
    query: string,
  ): Promise<Result<PoolCandidate[], AppError>> => {
    const searchPattern = `%${query}%`;

    const rows = (await db.execute(sql`
      SELECT
        pi.id,
        'playout' AS "sourceType",
        pi.title,
        pi.duration,
        NULL AS creator
      FROM playout_items pi
      WHERE pi.title ILIKE ${searchPattern}
        AND pi.processing_status = 'ready'
        AND pi.id NOT IN (
          SELECT playout_item_id FROM channel_content
          WHERE channel_id = ${channelId}
            AND playout_item_id IS NOT NULL
        )

      UNION ALL

      SELECT
        c.id,
        'content' AS "sourceType",
        c.title,
        c.duration,
        cp.display_name AS creator
      FROM content c
      LEFT JOIN creator_profiles cp ON cp.id = c.creator_id
      WHERE c.title ILIKE ${searchPattern}
        AND c.type = 'video'
        AND (c.processing_status = 'completed' OR c.processing_status IS NULL)
        AND c.id NOT IN (
          SELECT content_id FROM channel_content
          WHERE channel_id = ${channelId}
            AND content_id IS NOT NULL
        )

      ORDER BY title ASC
      LIMIT 20
    `)) as Array<{
      id: string;
      sourceType: "playout" | "content";
      title: string;
      duration: number | null;
      creator: string | null;
    }>;

    return ok(
      rows.map((row) => ({
        id: row.id,
        sourceType: row.sourceType,
        title: row.title,
        duration: row.duration ?? null,
        creator: row.creator ?? null,
      })),
    );
  };

  // ── Startup ──

  /**
   * Initialize all playout channels on API startup.
   * For each active playout channel: auto-fill if queue is empty,
   * then push prefetch buffer to Liquidsoap.
   */
  const initialize = async (): Promise<void> => {
    const playoutChannels = await db
      .select()
      .from(channels)
      .where(
        and(
          eq(channels.type, "playout"),
          eq(channels.isActive, true),
        ),
      );

    if (playoutChannels.length === 0) {
      logger.debug("No active playout channels found during initialization");
      return;
    }

    // Reset pushed_to_liquidsoap for all active queue items — Liquidsoap's
    // in-memory queue is empty after a restart, so everything needs re-pushing.
    await db
      .update(playoutQueue)
      .set({ pushedToLiquidsoap: false })
      .where(
        and(
          inArray(playoutQueue.channelId, playoutChannels.map((c) => c.id)),
          inArray(playoutQueue.status, ["queued", "playing"]),
          eq(playoutQueue.pushedToLiquidsoap, true),
        ),
      );

    for (const channel of playoutChannels) {
      try {
        await autoFill(channel.id);
      } catch (error) {
        logger.error(
          {
            channelId: channel.id,
            err: error,
            error: error instanceof Error ? error.message : String(error),
          },
          "Auto-fill failed during initialization",
        );
      }

      try {
        await pushPrefetchBuffer(channel.id);
      } catch (error) {
        logger.error(
          {
            channelId: channel.id,
            err: error,
            error: error instanceof Error ? error.message : String(error),
          },
          "Prefetch push failed during initialization",
        );
      }
    }

    logger.info(
      { channelCount: playoutChannels.length },
      "Playout channels initialized",
    );
  };

  return {
    getChannelQueueStatus,
    getMultiChannelQueueStatus,
    onTrackStarted,
    insertIntoQueue,
    removeFromQueue,
    skip,
    assignContent,
    removeContent,
    listContent,
    searchAvailableContent,
    autoFill,
    initialize,
  };
};
