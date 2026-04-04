import { randomUUID } from "node:crypto";

import { eq, asc, and, sql } from "drizzle-orm";
import { AppError, NotFoundError, ok, err } from "@snc/shared";
import type {
  Result,
  PlayoutItem,
  CreatePlayoutItem,
  UpdatePlayoutItem,
  NowPlaying,
  PlayoutStatus,
} from "@snc/shared";

import { getBoss } from "../jobs/boss.js";
import { JOB_QUEUES } from "../jobs/register-workers.js";

import { db } from "../db/connection.js";
import { playoutItems } from "../db/schema/playout.schema.js";
import { channels } from "../db/schema/streaming.schema.js";
import { rootLogger } from "../logging/logger.js";
import { getNowPlaying as getLiquidsoapNowPlaying } from "./liquidsoap.js";
import {
  selectPlayoutRenditionUri,
  RENDITION_COLUMNS as RENDITION_COLUMNS_FROM_UTILS,
} from "./playout-utils.js";
import { orchestrator } from "../routes/playout-channels.init.js";

const logger = rootLogger.child({ service: "playout" });

// ── Private Helpers ──

/** Get the default active playout channel ID for legacy admin operations. */
const getDefaultPlayoutChannelId = async (): Promise<string | null> => {
  const [channel] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.type, "playout"), eq(channels.isActive, true)));
  return channel?.id ?? null;
};

// ── Row → Response transformer ──

const toPlayoutItem = (row: typeof playoutItems.$inferSelect): PlayoutItem => ({
  id: row.id,
  title: row.title,
  year: row.year,
  director: row.director,
  duration: row.duration,
  sourceWidth: row.sourceWidth,
  sourceHeight: row.sourceHeight,
  processingStatus: row.processingStatus as PlayoutItem["processingStatus"],
  position: row.position,
  enabled: row.enabled,
  renditions: {
    source: row.sourceKey !== null,
    "1080p": row.rendition1080pKey !== null,
    "720p": row.rendition720pKey !== null,
    "480p": row.rendition480pKey !== null,
    audio: row.renditionAudioKey !== null,
  },
  hasSubtitles: row.subtitleKey !== null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

// ── CRUD ──

/** List all playout items ordered by position. */
export const listPlayoutItems = async (): Promise<PlayoutItem[]> => {
  const rows = await db
    .select()
    .from(playoutItems)
    .orderBy(asc(playoutItems.position));
  return rows.map(toPlayoutItem);
};

/** Get a single playout item by ID. */
export const getPlayoutItem = async (
  id: string,
): Promise<Result<PlayoutItem, AppError>> => {
  const [row] = await db
    .select()
    .from(playoutItems)
    .where(eq(playoutItems.id, id));
  if (!row) return err(new NotFoundError("Playout item not found"));
  return ok(toPlayoutItem(row));
};

/** Create a new playout item. Assigns position at end of playlist. */
export const createPlayoutItem = async (
  data: CreatePlayoutItem,
): Promise<Result<PlayoutItem, AppError>> => {
  const id = randomUUID();
  const maxPosition = await db
    .select({ max: sql`COALESCE(MAX(${playoutItems.position}), -1)` })
    .from(playoutItems);
  const position = (maxPosition[0]?.max as number) + 1;

  const [row] = await db
    .insert(playoutItems)
    .values({
      id,
      title: data.title,
      year: data.year ?? null,
      director: data.director ?? null,
      s3KeyPrefix: `playout/${id}`,
      position,
    })
    .returning();

  return ok(toPlayoutItem(row!));
};

/** Update a playout item's metadata. */
export const updatePlayoutItem = async (
  id: string,
  data: UpdatePlayoutItem,
): Promise<Result<PlayoutItem, AppError>> => {
  const [row] = await db
    .update(playoutItems)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(playoutItems.id, id))
    .returning();
  if (!row) return err(new NotFoundError("Playout item not found"));

  return ok(toPlayoutItem(row));
};

/** Delete a playout item and reorder remaining items. */
export const deletePlayoutItem = async (
  id: string,
): Promise<Result<void, AppError>> => {
  const [deleted] = await db
    .delete(playoutItems)
    .where(eq(playoutItems.id, id))
    .returning({ id: playoutItems.id });
  if (!deleted) return err(new NotFoundError("Playout item not found"));

  // Reindex positions in a single UPDATE using a VALUES CTE
  const remaining = await db
    .select({ id: playoutItems.id })
    .from(playoutItems)
    .orderBy(asc(playoutItems.position));

  if (remaining.length > 0) {
    await db.execute(sql`
      UPDATE playout_items SET position = v.pos
      FROM (VALUES ${sql.join(remaining.map((r, i) => sql`(${r.id}, ${i})`), sql`, `)}) AS v(id, pos)
      WHERE playout_items.id = v.id::text
    `);
  }

  return ok(undefined);
};

// Re-export for backwards compatibility with existing callers (ingest handler, etc.)
export { RENDITION_COLUMNS_FROM_UTILS as RENDITION_COLUMNS };

// ── Now-Playing (correlate Liquidsoap data with DB) ──

/**
 * Get enriched now-playing data. Fetches raw data from Liquidsoap,
 * correlates the S3 URI to a playout item, and enriches with metadata.
 *
 * Used for the broadcast channel (S/NC TV) which still uses the legacy /now-playing endpoint.
 */
export const getPlayoutNowPlaying = async (
  srsStreamName?: string,
): Promise<NowPlaying | null> => {
  void srsStreamName; // No longer used for routing — kept for signature compatibility
  const raw = await getLiquidsoapNowPlaying();
  if (!raw) return null;

  // Extract item ID from S3 URI: s3://snc-storage/playout/{id}/rendition.mp4
  const match = raw.uri.match(/playout\/([^/]+)\//);
  if (!match) {
    return {
      itemId: null,
      title: raw.title || null,
      year: null,
      director: null,
      duration: null,
      elapsed: raw.elapsed,
      remaining: raw.remaining,
    };
  }

  const itemId = match[1]!;
  const [row] = await db
    .select()
    .from(playoutItems)
    .where(eq(playoutItems.id, itemId));

  return {
    itemId: row?.id ?? null,
    title: row?.title ?? raw.title ?? null,
    year: row?.year ?? null,
    director: row?.director ?? null,
    duration: row?.duration ?? null,
    elapsed: raw.elapsed,
    remaining: raw.remaining,
  };
};

// ── Queue Controls (bridged to orchestrator for backward compatibility) ──

/**
 * Get full playout status for admin UI.
 * Delegates to the orchestrator's queue status for the default active playout channel.
 */
export const getPlayoutStatus = async (): Promise<PlayoutStatus> => {
  const channelId = await getDefaultPlayoutChannelId();
  if (!channelId) {
    return { nowPlaying: null, queuedItems: [] };
  }

  const result = await orchestrator.getChannelQueueStatus(channelId);
  if (!result.ok) {
    logger.warn({ error: result.error }, "Failed to get channel queue status");
    return { nowPlaying: null, queuedItems: [] };
  }

  const { nowPlaying: np, upcoming } = result.value;

  const nowPlaying: NowPlaying | null = np
    ? {
        itemId: np.playoutItemId,
        title: np.title,
        year: null,
        director: null,
        duration: np.duration,
        elapsed: -1,
        remaining: -1,
      }
    : null;

  return {
    nowPlaying,
    queuedItems: upcoming.map((entry) => ({
      itemId: entry.playoutItemId,
      title: entry.title,
      queuedAt: entry.createdAt,
    })),
  };
};

/** Queue a playout item to play next by its ID. Delegates to the orchestrator. */
export const queuePlayoutItem = async (
  itemId: string,
): Promise<Result<void, AppError>> => {
  const [row] = await db
    .select()
    .from(playoutItems)
    .where(eq(playoutItems.id, itemId));
  if (!row) return err(new NotFoundError("Playout item not found"));

  const uri = selectPlayoutRenditionUri(row);
  if (!uri) return err(new AppError("NO_RENDITION", "No playable rendition available", 400));

  const channelId = await getDefaultPlayoutChannelId();
  if (!channelId) {
    return err(new AppError("NO_PLAYOUT_CHANNEL", "No active playout channel found", 503));
  }

  const result = await orchestrator.insertIntoQueue(channelId, itemId);
  if (!result.ok) return result;
  return ok(undefined);
};

/** Skip the current track on the default active playout channel. */
export const skipCurrentTrack = async (): Promise<Result<void, AppError>> => {
  const channelId = await getDefaultPlayoutChannelId();
  if (!channelId) {
    return err(new AppError("NO_PLAYOUT_CHANNEL", "No active playout channel found", 503));
  }
  return orchestrator.skip(channelId);
};

/**
 * Reset a failed playout item to pending and re-enqueue the ingest job.
 * Guards against retrying items not in failed state.
 *
 * @throws Never — returns Result
 */
export const retryPlayoutIngest = async (
  id: string,
): Promise<Result<void, AppError>> => {
  const [row] = await db
    .select()
    .from(playoutItems)
    .where(eq(playoutItems.id, id));

  if (!row) return err(new NotFoundError("Playout item not found"));

  if (row.processingStatus !== "failed") {
    return err(
      new AppError(
        "INVALID_STATE",
        `Cannot retry item in state: ${row.processingStatus}`,
        409,
      ),
    );
  }

  if (!row.sourceKey) {
    return err(
      new AppError(
        "NO_SOURCE",
        "Item has no source file — upload a file before retrying",
        422,
      ),
    );
  }

  await db
    .update(playoutItems)
    .set({ processingStatus: "pending", updatedAt: new Date() })
    .where(eq(playoutItems.id, id));

  const boss = getBoss();
  if (boss) {
    await boss.send(JOB_QUEUES.PLAYOUT_INGEST, { playoutItemId: id });
  }

  return ok(undefined);
};
