import { randomUUID } from "node:crypto";

import { and, eq, isNull, isNotNull, desc } from "drizzle-orm";
import type { AppError, Result } from "@snc/shared";
import { ok } from "@snc/shared";

import { db } from "../db/connection.js";
import { streamSessions, streamEvents } from "../db/schema/streaming.schema.js";

// ── Public Types ──

export type ActiveSessionInfo = {
  sessionId: string;
  creatorId: string;
  streamKeyId: string;
  srsStreamName: string;
  startedAt: Date;
};

// ── Public API ──

/**
 * Open a new stream session when a creator starts publishing.
 * Also logs the on_publish event.
 */
export const openSession = async (opts: {
  creatorId: string;
  streamKeyId: string;
  srsClientId: string;
  srsStreamName: string;
  callbackPayload: Record<string, unknown>;
}): Promise<Result<ActiveSessionInfo, AppError>> => {
  const sessionId = randomUUID();
  const eventId = randomUUID();

  const [session] = await db
    .insert(streamSessions)
    .values({
      id: sessionId,
      creatorId: opts.creatorId,
      streamKeyId: opts.streamKeyId,
      srsClientId: opts.srsClientId,
      srsStreamName: opts.srsStreamName,
    })
    .returning();

  await db.insert(streamEvents).values({
    id: eventId,
    sessionId,
    eventType: "on_publish",
    payload: opts.callbackPayload,
  });

  return ok({
    sessionId: session!.id,
    creatorId: session!.creatorId,
    streamKeyId: session!.streamKeyId,
    srsStreamName: session!.srsStreamName,
    startedAt: session!.startedAt,
  });
};

/**
 * Close an active session when a creator stops publishing.
 * Matches by SRS client_id. Logs the on_unpublish event.
 */
export const closeSession = async (opts: {
  srsClientId: string;
  callbackPayload: Record<string, unknown>;
}): Promise<Result<void, AppError>> => {
  const [session] = await db
    .select()
    .from(streamSessions)
    .where(
      and(
        eq(streamSessions.srsClientId, opts.srsClientId),
        isNull(streamSessions.endedAt),
      ),
    );

  if (!session) {
    // No active session — log the event anyway for audit
    await db.insert(streamEvents).values({
      id: randomUUID(),
      sessionId: null,
      eventType: "on_unpublish",
      payload: opts.callbackPayload,
    });
    return ok(undefined);
  }

  await db
    .update(streamSessions)
    .set({ endedAt: new Date() })
    .where(eq(streamSessions.id, session.id));

  await db.insert(streamEvents).values({
    id: randomUUID(),
    sessionId: session.id,
    eventType: "on_unpublish",
    payload: opts.callbackPayload,
  });

  return ok(undefined);
};

/**
 * Get all currently active sessions (where endedAt is null).
 */
export const getActiveSessions = async (): Promise<
  Array<typeof streamSessions.$inferSelect>
> => {
  return db
    .select()
    .from(streamSessions)
    .where(isNull(streamSessions.endedAt))
    .orderBy(desc(streamSessions.startedAt));
};

/**
 * Get the most recent completed session timestamp for lastLiveAt.
 */
export const getLastLiveAt = async (): Promise<Date | null> => {
  const [row] = await db
    .select({ endedAt: streamSessions.endedAt })
    .from(streamSessions)
    .where(isNotNull(streamSessions.endedAt))
    .orderBy(desc(streamSessions.endedAt))
    .limit(1);

  return row?.endedAt ?? null;
};
