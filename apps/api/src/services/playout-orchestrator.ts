import { randomUUID } from "node:crypto";

import { eq, and, asc, sql, inArray } from "drizzle-orm";
import { AppError, NotFoundError, ForbiddenError, ok, err } from "@snc/shared";
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
import { markPlayed, promoteNext, enqueue, enqueueBatch, removeQueued } from "./playout-queue-transitions.js";
import type { QueueSource } from "./playout-queue-transitions.js";
import { playoutItems } from "../db/schema/playout.schema.js";
import { content } from "../db/schema/content.schema.js";
import { creatorProfiles } from "../db/schema/creator.schema.js";
import { channels } from "../db/schema/streaming.schema.js";
import { config } from "../config.js";
import { rootLogger } from "../logging/logger.js";
import { selectPlayoutRenditionUri } from "./playout-utils.js";
import { poolContentScope } from "./editorial-config.js";
import type { PoolScope } from "./editorial-config.js";
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

// ── Queue-status read projection ──

/**
 * Column projection for queue-status reads. The queue is source-polymorphic
 * (`playout_item_id` XOR `content_id`, enforced by the `playout_queue_one_source`
 * CHECK), so reads LEFT JOIN both `playout_items` and `content` and coalesce the
 * display fields from whichever side is set. An INNER JOIN against `playout_items`
 * would silently drop every content-source row — the read bug this fixes.
 *
 * `sourceType` is derived from which FK is populated; `coalesce` picks the live
 * title/duration. Shared by `getChannelQueueStatus` and `getMultiChannelQueueStatus`
 * so the two reads never drift.
 */
const QUEUE_STATUS_COLUMNS = {
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

// ── Row → Response transformer ──

const toQueueEntry = (
  row: typeof playoutQueue.$inferSelect & {
    sourceType: "playout" | "content";
    title: string | null;
    duration: number | null;
  },
): PlayoutQueueEntry => ({
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

  // ── Pool scope ──

  /**
   * Resolve the content-pool scope a channel draws from, derived from the
   * channel's ownership row — never from caller input.
   *
   * Creator-owned channels resolve to `{ creatorId }` so the content search +
   * assign + queue-insert paths are constrained to that creator's own pool.
   * Platform/admin channels resolve to `{ allCreators: true }` — the pre-existing
   * admin behavior, unchanged.
   *
   * Fails CLOSED: when the channel row is absent the helper returns a
   * `NotFoundError`, never a scope. This is a security boundary shared by both the
   * admin orchestrator path (platform channel → all content) and the creator path
   * (creator channel → own content only); a missing / raced / bogus-id lookup must
   * NEVER default to the most-permissive admin-wide scope. A real channel always
   * resolves to its true scope (a platform row → `{ allCreators: true }`, a creator
   * row → `{ creatorId }`), so admin behavior is unchanged for any existing channel.
   *
   * The scope is unspoofable because it comes from the channel record keyed by the
   * route's `:channelId`, not from any caller input.
   *
   * @returns NotFoundError when no channel row exists for `channelId`.
   */
  const resolvePoolScope = async (
    channelId: string,
  ): Promise<Result<PoolScope, NotFoundError>> => {
    const rows = (await db.execute(sql`
      SELECT ownership, creator_id AS "creatorId"
      FROM channels
      WHERE id = ${channelId}
    `)) as Array<{ ownership: string; creatorId: string | null }>;

    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) {
      // Channel genuinely does not exist — fail closed. Returning the admin-wide
      // scope here would let a missing/bogus channelId reach all-creator content.
      return err(new NotFoundError("Channel not found"));
    }
    return ok(poolContentScope(row));
  };

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
      await markPlayed(playing.id, playing.channelId);

      // Update the matching pool row's play stats, keyed on whichever source the
      // playing queue row carries. A content row sets `content_id` (playoutItemId is
      // null); matching on the null column (`playout_item_id = NULL`) would update
      // nothing — so dispatch on the populated source.
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

    // 3. Promote next queued to playing
    await promoteNext(channelId);

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
   *
   * The source is polymorphic — exactly one of `playoutItemId` (admin/library item)
   * or `contentId` (creator content piece) — matching the source-polymorphic queue
   * schema and the transitions layer's `QueueSource`. The pool chokepoint and the
   * existence validation both key off whichever source was supplied.
   *
   * Scope-gated like the rest of the shared editorial surface: the scope is
   * derived from the channel's ownership row (`resolvePoolScope`), never the caller.
   *
   * - Creator-owned channel (`{ creatorId }`): the source MUST already be in THIS
   *   channel's content pool (`channel_content`) — matched on the SAME column the
   *   source sets (`content_id` for a content source, `playout_item_id` for a playout
   *   source). The pool is creator-scoped (the search/assign paths only admit the
   *   creator's own content, and `assignContent` forbids platform playout items into a
   *   creator pool), so the scoped pool is the single chokepoint: a creator cannot
   *   queue an arbitrary platform/other-creator id they happen to know. A source
   *   outside the pool is rejected as `ForbiddenError` (matching the round-1
   *   assign-rejection code, and not leaking whether the foreign item exists) and
   *   nothing is enqueued.
   * - Platform/admin channel (`{ allCreators: true }`): unchanged — admins legitimately
   *   queue from the full playout library, so only the existence check below applies.
   *
   * Fails closed: a missing channel row resolves to NotFoundError (never admin scope).
   *
   * @param source - `{ playoutItemId }` (library) XOR `{ contentId }` (creator content).
   * @returns ForbiddenError when a creator channel queues a source outside its pool;
   *   NotFoundError when the source row does not exist; otherwise the new entry.
   */
  const insertIntoQueue = async (
    channelId: string,
    source: QueueSource,
    position?: number,
  ): Promise<Result<PlayoutQueueEntry, AppError>> => {
    // 1. Resolve the channel's pool scope (fails closed on a missing channel).
    const scopeResult = await resolvePoolScope(channelId);
    if (!scopeResult.ok) return scopeResult;
    const scope = scopeResult.value;

    const isPlayoutSource = "playoutItemId" in source;
    const sourceId = isPlayoutSource ? source.playoutItemId : source.contentId;

    // 1a. Creator channels may only queue sources already in their scoped pool —
    //     the pool is the chokepoint that keeps cross-tenant items out of playback.
    //     Match on the SAME column the source sets so a content source is checked
    //     against `content_id` and a playout source against `playout_item_id`;
    //     keying the wrong column would let an unpooled source slip through.
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

    // 2. Validate the source row exists, against the table the source names, and
    //    capture its display fields for the response.
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

    // 3. Create queue entry (position-shift + insert delegated to transitions)
    const row = await enqueue({
      channelId,
      source,
      ...(position !== undefined ? { position } : {}),
    });

    if (!row) {
      return err(new AppError("INSERT_FAILED", "Failed to insert queue entry", 500));
    }

    // 4. Push prefetch buffer if within prefetch window
    await pushPrefetchBuffer(channelId);

    return ok(toQueueEntry({ ...row, sourceType, title, duration }));
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

    return removeQueued(entry);
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
      await markPlayed(playing.id, playing.channelId);
    }

    // 2. Tell Liquidsoap to skip
    const skipResult = await client.skipTrack(channelId);
    if (!skipResult.ok) {
      logger.warn({ channelId, error: skipResult.error }, "Liquidsoap skipTrack failed");
    }

    // 3. Promote next queued entry to playing
    await promoteNext(channelId);

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
   *
   * Ownership is enforced from the channel, never the caller. For a creator-owned
   * channel (`{ creatorId }` scope) every requested `contentId` must belong to that
   * creator and not be soft-deleted, and platform-shared `playoutItemIds` may not be
   * assigned at all (creator pools are content-only) — a cross-creator or playout-item
   * request is rejected as `ForbiddenError` and nothing is written. Platform/admin
   * channels (`{ allCreators: true }`) keep the prior unconstrained behavior.
   *
   * @returns ForbiddenError when a creator channel requests content it does not own
   *   or any playout item; otherwise ok once the pool entries are inserted.
   */
  const assignContent = async (
    channelId: string,
    playoutItemIds: string[],
    contentIds?: string[],
  ): Promise<Result<void, AppError>> => {
    const requestedContentIds = contentIds ?? [];
    const scopeResult = await resolvePoolScope(channelId);
    if (!scopeResult.ok) return scopeResult;
    const scope = scopeResult.value;

    if ("creatorId" in scope) {
      // Creator pools are content-only — the playout-item branch is the platform's
      // shared media library, off-limits to a creator's own channel pool.
      if (playoutItemIds.length > 0) {
        return err(
          new ForbiddenError(
            "Creator channels may not assign platform playout items to their content pool",
          ),
        );
      }

      // Every requested content id must belong to this creator and not be deleted.
      if (requestedContentIds.length > 0) {
        const ownedRows = await db
          .select({ id: content.id })
          .from(content)
          .where(
            and(
              inArray(content.id, requestedContentIds),
              eq(content.creatorId, scope.creatorId),
              sql`${content.deletedAt} IS NULL`,
            ),
          );

        const ownedIds = new Set(ownedRows.map((r) => r.id));
        const disallowed = requestedContentIds.filter((id) => !ownedIds.has(id));
        if (disallowed.length > 0) {
          logger.warn(
            { channelId, creatorId: scope.creatorId, disallowed },
            "Rejected creator content assignment — ids not owned by channel creator",
          );
          return err(
            new ForbiddenError(
              "One or more content items do not belong to this creator",
            ),
          );
        }
      }
    }

    const playoutValues = playoutItemIds.map((playoutItemId) => ({
      id: randomUUID(),
      channelId,
      playoutItemId,
      contentId: null,
    }));

    const contentValues = requestedContentIds.map((contentId) => ({
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

  /**
   * List content pool items for a channel, enriched with title, duration, and source type.
   *
   * Scope is derived from the channel, never the caller (mirrors `searchAvailableContent`).
   * This is a read-side tenant guard, NOT merely a convenience: the pool *should* only hold
   * own content because every write path (`assignContent`) is creator-scoped, but the read must
   * not rely on that invariant holding forever. A creator-owned channel (`{ creatorId }`) lists
   * ONLY that creator's own non-deleted content — the platform playout-item branch is suppressed
   * (creator pools are content-only) and a stale / foreign / soft-deleted `channel_content` row is
   * never surfaced. A platform/admin channel (`{ allCreators: true }`) lists the full pool exactly
   * as before.
   */
  const listContent = async (
    channelId: string,
  ): Promise<Result<ChannelContent[], AppError>> => {
    const scopeResult = await resolvePoolScope(channelId);
    if (!scopeResult.ok) return scopeResult;
    const scope = scopeResult.value;
    const creatorScoped = "creatorId" in scope;

    // Playout-item branch — platform-shared media. Listed for admin/platform channels;
    // suppressed for creator channels (content-only pools, matching searchAvailableContent).
    const playoutBranch = creatorScoped
      ? sql``
      : sql`
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
`;

    // Content branch — for creator channels, constrained to the channel's creator and
    // non-deleted rows. For admin/platform channels, unconstrained (unchanged).
    const contentOwnershipFilter = creatorScoped
      ? sql`AND c.creator_id = ${scope.creatorId}
        AND c.deleted_at IS NULL`
      : sql``;

    // Use raw SQL to UNION results from both playout_items and content tables
    const rows = (await db.execute(sql`${playoutBranch}
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
        ${contentOwnershipFilter}

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

    // Resolve the channel's pool scope (fails closed on a missing channel) so the
    // candidate selection is tenant-safe at READ time — not trusting that every
    // channel_content write was perfectly scoped. This mirrors the listContent /
    // searchAvailableContent read-side guard: a directly-polluted, stale, or
    // soft-deleted row must not be auto-queued for a creator channel.
    const autoFillScopeResult = await resolvePoolScope(channelId);
    if (!autoFillScopeResult.ok) {
      // Missing channel — nothing to fill; never fall through to an unscoped query.
      logger.debug({ channelId }, "Auto-fill: channel not found, skipping");
      return;
    }
    const autoFillScope = autoFillScopeResult.value;
    const autoFillCreatorScoped = "creatorId" in autoFillScope;

    // Playout-item arm — platform-shared media. Suppressed for creator channels
    // (creator pools are content-only), exactly as searchAvailableContent does.
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

    // Content arm — for creator channels, constrained to the channel's own creator
    // and non-deleted rows (read-side tenant guard; matches listContent's filter).
    const autoFillContentOwnershipFilter = autoFillCreatorScoped
      ? sql`AND c.creator_id = ${autoFillScope.creatorId}
          AND c.deleted_at IS NULL`
      : sql``;

    // Select from content pool, excluding items already in queue.
    // Each arm carries its REAL source type + id — a content row's id stays in the
    // content column, never aliased into `playout_item_id` (that alias jammed a
    // content.id into the playout-item FK and threw on insert; this is the fix).
    // The exclusion subqueries are per-column so a content row is deduped against
    // content_id and a playout row against playout_item_id.
    // ORDER BY: last_played_at ASC NULLS FIRST, play_count ASC, random()
    // Note: db.execute() with postgres-js returns rows directly as an array (not { rows: [...] })
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

    // Map each candidate to its typed QueueSource — the right column is written per
    // source, satisfying the one-source CHECK. No FK violation: a content id lands in
    // content_id, a playout id in playout_item_id.
    const sources: QueueSource[] = candidateRows.map((r) =>
      r.source_type === "playout"
        ? { playoutItemId: r.source_id }
        : { contentId: r.source_id },
    );

    // Batch-insert candidates (MAX(position) read + INSERT delegated to transitions)
    const added = await enqueueBatch(channelId, sources);

    logger.info(
      { channelId, added },
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
      // Resolve from whichever source the row carries — `resolveContentUri` already
      // handles a content source (transcoded ?? media key) the same way it handles a
      // playout item. A content row whose contentId is dropped here would never push.
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

  // ── Content Search ──

  /**
   * Search for items available to add to a channel's content pool.
   * Returns playout items and creator content not already in the pool.
   * Results are case-insensitively filtered by title, limited to 20.
   *
   * Scope is derived from the channel, never the caller. A creator-owned channel
   * (`{ creatorId }`) sees ONLY that creator's own non-deleted content — the
   * platform playout-item branch is excluded entirely (creator pools are
   * content-only) and other creators' content never surfaces. A platform/admin
   * channel (`{ allCreators: true }`) returns the full unconstrained set exactly as
   * before. A creator's own content is offered regardless of publish/visibility
   * state — it is theirs, bound for their own channel; the leak guarded here is
   * specifically *other* creators' content.
   */
  const searchAvailableContent = async (
    channelId: string,
    query: string,
  ): Promise<Result<PoolCandidate[], AppError>> => {
    const searchPattern = `%${query}%`;
    const scopeResult = await resolvePoolScope(channelId);
    if (!scopeResult.ok) return scopeResult;
    const scope = scopeResult.value;
    const creatorScoped = "creatorId" in scope;

    // Playout-item branch — platform-shared media. Included for admin/platform
    // channels; suppressed for creator channels (content-only pools).
    const playoutBranch = creatorScoped
      ? sql``
      : sql`
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
`;

    // Content branch — for creator channels, constrained to the channel's creator
    // and non-deleted rows. For admin/platform channels, unconstrained (unchanged).
    const contentOwnershipFilter = creatorScoped
      ? sql`AND c.creator_id = ${scope.creatorId}
        AND c.deleted_at IS NULL`
      : sql``;

    const rows = (await db.execute(sql`${playoutBranch}
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
        AND (c.processing_status = 'ready' OR c.processing_status IS NULL)
        ${contentOwnershipFilter}
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
          eq(channels.role, "playout"),
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
