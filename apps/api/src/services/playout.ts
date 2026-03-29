import { randomUUID } from "node:crypto";
import { writeFile, rename } from "node:fs/promises";
import path from "node:path";

import { eq, asc, and, sql } from "drizzle-orm";
import { AppError, NotFoundError, ok, err } from "@snc/shared";
import type {
  Result,
  PlayoutItem,
  CreatePlayoutItem,
  UpdatePlayoutItem,
  NowPlaying,
  PlayoutStatus,
  Rendition,
} from "@snc/shared";

import { db } from "../db/connection.js";
import { playoutItems } from "../db/schema/playout.schema.js";
import { rootLogger } from "../logging/logger.js";
import { getNowPlaying as getLiquidsoapNowPlaying, skipTrack, queueTrack } from "./liquidsoap.js";

const logger = rootLogger.child({ service: "playout" });

// ── Playlist M3U path ──

const PLAYLIST_DIR = path.resolve(
  import.meta.dirname,
  "../../../../liquidsoap",
);
const PLAYLIST_PATH = path.join(PLAYLIST_DIR, "playlist.m3u");

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

/** Update a playout item's metadata or enabled state. */
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

  await regeneratePlaylist();
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

  await regeneratePlaylist();
  return ok(undefined);
};

/** Reorder playout items by providing an ordered list of IDs. */
export const reorderPlayoutItems = async (
  orderedIds: string[],
): Promise<Result<PlayoutItem[], AppError>> => {
  if (orderedIds.length > 0) {
    await db.execute(sql`
      UPDATE playout_items SET position = v.pos, updated_at = NOW()
      FROM (VALUES ${sql.join(orderedIds.map((id, i) => sql`(${id}, ${i})`), sql`, `)}) AS v(id, pos)
      WHERE playout_items.id = v.id::text
    `);
  }

  await regeneratePlaylist();
  return ok(await listPlayoutItems());
};

// ── Playlist Generation ──

/**
 * Regenerate the M3U playlist file from the database.
 * Includes only enabled items with processingStatus "ready".
 * Uses the 1080p rendition, falling back to the highest available.
 * Atomic write: temp file → rename.
 */
export const regeneratePlaylist = async (): Promise<void> => {
  const rows = await db
    .select()
    .from(playoutItems)
    .where(
      and(
        eq(playoutItems.enabled, true),
        eq(playoutItems.processingStatus, "ready"),
      ),
    )
    .orderBy(asc(playoutItems.position));

  const lines = ["#EXTM3U"];
  for (const row of rows) {
    const uri = selectPlayoutRenditionUri(row);
    if (uri) {
      if (row.duration) {
        lines.push(`#EXTINF:${Math.round(row.duration)},${row.title}`);
      }
      lines.push(uri);
    }
  }

  const tempPath = `${PLAYLIST_PATH}.tmp`;
  await writeFile(tempPath, lines.join("\n") + "\n");
  await rename(tempPath, PLAYLIST_PATH);
  logger.info({ items: rows.length }, "Playlist regenerated");
};

/** Select the best available rendition URI for playout (1080p preferred). */
const selectPlayoutRenditionUri = (
  row: typeof playoutItems.$inferSelect,
): string | null => {
  const bucket = "snc-storage";
  if (row.rendition1080pKey) return `s3://${bucket}/${row.rendition1080pKey}`;
  if (row.rendition720pKey) return `s3://${bucket}/${row.rendition720pKey}`;
  if (row.rendition480pKey) return `s3://${bucket}/${row.rendition480pKey}`;
  if (row.sourceKey) return `s3://${bucket}/${row.sourceKey}`;
  return null;
};

// ── Rendition Column Mapping ──

/** Rendition column mapping — used by the ingest handler to update the correct column. */
export const RENDITION_COLUMNS = {
  "1080p": "rendition1080pKey",
  "720p": "rendition720pKey",
  "480p": "rendition480pKey",
  "audio": "renditionAudioKey",
} as const satisfies Record<Rendition, keyof typeof playoutItems.$inferSelect>;

// ── Now-Playing (correlate Liquidsoap data with DB) ──

/**
 * Get enriched now-playing data. Fetches raw data from Liquidsoap,
 * correlates the S3 URI to a playout item, and enriches with metadata.
 */
export const getPlayoutNowPlaying = async (): Promise<NowPlaying | null> => {
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

// ── Queue Controls ──

/** Get full playout status for admin UI. */
export const getPlayoutStatus = async (): Promise<PlayoutStatus> => {
  const nowPlaying = await getPlayoutNowPlaying();
  return { nowPlaying, queuedUri: null };
};

/** Queue a playout item to play next by its ID. */
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

  return queueTrack(uri);
};

/** Skip the current track. */
export const skipCurrentTrack = async (): Promise<Result<void, AppError>> => {
  return skipTrack();
};
