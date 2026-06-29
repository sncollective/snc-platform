import { randomUUID } from "node:crypto";

import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { AppError, err, ok } from "@snc/shared";
import type { Result } from "@snc/shared";

import { db } from "../db/connection.js";
import { playoutQueue } from "../db/schema/playout-queue.schema.js";
import { eventBus } from "./event-bus.js";
import { findChannelCreatorId } from "./channels.js";

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

/**
 * The single content source for a queue entry. Exactly one of `playoutItemId`
 * (admin/library playout item) or `contentId` (creator/content piece) is set;
 * the `playout_queue_one_source` DB CHECK (`num_nonnulls(...) = 1`) enforces it.
 *
 * Spread into an INSERT's `.values({...})` so the unset column is omitted —
 * Drizzle maps an omitted column to NULL, satisfying the exactly-one constraint.
 */
export type QueueSource = { playoutItemId: string } | { contentId: string };

/** Project a QueueSource into the column subset Drizzle inserts (the other column stays NULL). */
const sourceColumns = (
  source: QueueSource,
): { playoutItemId: string } | { contentId: string } =>
  "playoutItemId" in source
    ? { playoutItemId: source.playoutItemId }
    : { contentId: source.contentId };

// ── Private helpers ──

/**
 * Emit `content.playout-changed` for creator-owned channels after a queue transition.
 *
 * Resolves the channel's creatorId; if the channel is platform-owned or the
 * lookup fails, does nothing — the existing `playout.*` admin event covers those.
 * Fire-and-forget: errors are swallowed so they never fail a queue transition.
 */
const publishCreatorEditorialChange = async (
  channelId: string,
  changeType: "queue" | "now-playing",
): Promise<void> => {
  try {
    const creatorId = await findChannelCreatorId(channelId);
    if (!creatorId) return; // platform/admin channel — no creator emit needed
    eventBus.publish({ type: "content.playout-changed", channelId, creatorId, changeType });
  } catch {
    // fire-and-forget: a failed lookup or publish must never fail a transition
  }
};

// ── Transitions ──

/**
 * Mark the playing entry as played (playing → played).
 * Publishes `playout.now-playing-changed` — caller supplies the channelId from
 * the in-hand row to avoid a re-query (emission-asymmetry: markPlayed returns void).
 */
export const markPlayed = async (entryId: string, channelId: string): Promise<void> => {
  await db
    .update(playoutQueue)
    .set({ status: "played" })
    .where(eq(playoutQueue.id, entryId));
  try {
    eventBus.publish({ type: "playout.now-playing-changed", channelId });
  } catch {
    // fire-and-forget: publish must never fail a transition
  }
  await publishCreatorEditorialChange(channelId, "now-playing");
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

  try {
    eventBus.publish({ type: "playout.now-playing-changed", channelId });
  } catch {
    // fire-and-forget: publish must never fail a transition
  }
  await publishCreatorEditorialChange(channelId, "now-playing");

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
  source: QueueSource;
  position?: number;
  id?: string;
}): Promise<QueueRow | null> => {
  const { channelId, source, position } = opts;

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

  const id = opts.id ?? randomUUID();
  const [row] = await db
    .insert(playoutQueue)
    .values({
      id,
      channelId,
      ...sourceColumns(source),
      position: insertPosition,
      status: "queued",
      pushedToLiquidsoap: false,
    })
    .returning();

  if (row) {
    try {
      eventBus.publish({ type: "playout.queue-changed", channelId });
    } catch {
      // fire-and-forget: publish must never fail a transition
    }
    await publishCreatorEditorialChange(channelId, "queue");
  }

  return row ?? null;
};

/**
 * Batch birth (auto-fill): reads MAX(position) over live rows, inserts all
 * sources at consecutive positions starting from max+1. Each source writes
 * exactly one of `playoutItemId` / `contentId` per the one-source CHECK.
 * Returns the number of rows inserted.
 */
export const enqueueBatch = async (
  channelId: string,
  sources: QueueSource[],
): Promise<number> => {
  if (sources.length === 0) return 0;

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

  const newEntries = sources.map((source) => ({
    id: randomUUID(),
    channelId,
    ...sourceColumns(source),
    position: nextPosition++,
    status: "queued" as const,
    pushedToLiquidsoap: false,
  }));

  await db.insert(playoutQueue).values(newEntries);

  const count = newEntries.length;
  if (count > 0) {
    try {
      eventBus.publish({ type: "playout.queue-changed", channelId });
    } catch {
      // fire-and-forget: publish must never fail a transition
    }
    await publishCreatorEditorialChange(channelId, "queue");
  }

  return count;
};

/**
 * Remove a live queue entry. Guard: refuses to delete the currently playing entry.
 * Caller passes the already-loaded row — no re-read here.
 * Returns err(CANNOT_REMOVE_PLAYING 409) if status is "playing", ok(undefined) otherwise.
 * Publishes `playout.queue-changed` on success.
 */
export const removeQueued = async (entry: {
  id: string;
  channelId: string;
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

  try {
    eventBus.publish({ type: "playout.queue-changed", channelId: entry.channelId });
  } catch {
    // fire-and-forget: publish must never fail a transition
  }
  await publishCreatorEditorialChange(entry.channelId, "queue");

  return ok(undefined);
};
