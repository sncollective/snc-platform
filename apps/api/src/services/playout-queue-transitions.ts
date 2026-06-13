import { randomUUID } from "node:crypto";

import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { AppError, err, ok } from "@snc/shared";
import type { Result } from "@snc/shared";

import { db } from "../db/connection.js";
import { playoutQueue } from "../db/schema/playout-queue.schema.js";

/**
 * Playout queue entry lifecycle transitions.
 *
 * This module is the ONLY writer of `playout_queue.status` and the only creator
 * or remover of live (queued/playing) queue rows. Every named transition here is a
 * future event-spine emission point (`bold-event-spine-publishers`). All other
 * `playoutQueue` writes — `pushedToLiquidsoap` flag updates, `position` shifts for
 * ordering mechanics — live in the orchestrator and are explicitly out of scope.
 */

// ── Row type ──

/** Inferred row type from the playout_queue schema. */
export type QueueRow = typeof playoutQueue.$inferSelect;

// ── Transitions ──

/** Mark the playing entry as played (playing → played). */
export const markPlayed = async (entryId: string): Promise<void> => {
  await db
    .update(playoutQueue)
    .set({ status: "played" })
    .where(eq(playoutQueue.id, entryId));
};

/**
 * Promote the next queued entry (lowest position) to playing.
 * Returns the promoted row, or null when the queue is empty.
 * Callers do not use the return value today — the event-spine publishers
 * feature (`bold-event-spine-publishers`) will consume it; returning it now
 * avoids a signature change later.
 */
export const promoteNext = async (channelId: string): Promise<QueueRow | null> => {
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

  if (!next) return null;

  await db
    .update(playoutQueue)
    .set({ status: "playing" })
    .where(eq(playoutQueue.id, next.id));

  return next;
};

/**
 * Birth: create a queued entry at the given position, or append to the end.
 * When position is given, shifts existing queued entries at >= position up by 1
 * first (same two statements, same order as the orchestrator's insertIntoQueue).
 * Returns the inserted row, or null when the INSERT returns no rows.
 */
export const enqueue = async (opts: {
  channelId: string;
  playoutItemId: string;
  position?: number;
}): Promise<QueueRow | null> => {
  const { channelId, playoutItemId, position } = opts;

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
    // Insert at end of queue (MAX over live rows)
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

  return row ?? null;
};

/**
 * Batch birth (auto-fill): reads MAX(position) over live rows, inserts all
 * playoutItemIds at consecutive positions starting from max+1.
 * Returns the number of rows inserted.
 */
export const enqueueBatch = async (
  channelId: string,
  playoutItemIds: string[],
): Promise<number> => {
  if (playoutItemIds.length === 0) return 0;

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

  const newEntries = playoutItemIds.map((playoutItemId) => ({
    id: randomUUID(),
    channelId,
    playoutItemId,
    position: nextPosition++,
    status: "queued" as const,
    pushedToLiquidsoap: false,
  }));

  await db.insert(playoutQueue).values(newEntries);

  return newEntries.length;
};

/**
 * Remove a live queue entry. Guard: refuses to delete the currently playing entry.
 * Caller passes the already-loaded row — no re-read here.
 * Returns err(CANNOT_REMOVE_PLAYING 409) if status is "playing", ok(undefined) otherwise.
 */
export const removeQueued = async (entry: {
  id: string;
  status: string;
}): Promise<Result<void, AppError>> => {
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
    .where(eq(playoutQueue.id, entry.id));

  return ok(undefined);
};
