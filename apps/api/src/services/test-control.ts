import { and, eq, like, or } from "drizzle-orm";
import { AppError, ok, err } from "@snc/shared";
import type { Result } from "@snc/shared";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { channelContent, playoutQueue } from "../db/schema/playout-queue.schema.js";
import { channels } from "../db/schema/streaming.schema.js";
import { enqueue } from "./playout-queue-transitions.js";

// ── Stable Demo Fixture IDs ──

const TEST_CONTROL_PREFIX = "e2e-tc-maya-programming";
const MAYA_CREATOR_ID = "00000000-0000-4000-a000-000000000002";
const MAYA_CHANNEL_ID = "00000000-0000-4000-c000-000000000001";
const STUDIO_TOUR_CONTENT_ID = "00000000-0000-4000-a000-000000000103";

const MAYA_POOL_ROW_ID = `${TEST_CONTROL_PREFIX}-pool-studio-tour`;
const MAYA_QUEUE_ROW_ID = `${TEST_CONTROL_PREFIX}-queue-studio-tour`;
const DEFAULT_QUEUE_POSITION = 1;

export type MayaProgrammingSeedOptions = {
  pool?: boolean | undefined;
  queue?: boolean | undefined;
};

export type MayaProgrammingState = {
  channelId: string;
  creatorId: string;
  contentId: string;
  seededPool: boolean;
  seededQueue: boolean;
};

// ── Private Helpers ──

const verifyMayaDemoRows = async (): Promise<Result<void, AppError>> => {
  const [channel] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(
      and(
        eq(channels.id, MAYA_CHANNEL_ID),
        eq(channels.creatorId, MAYA_CREATOR_ID),
        eq(channels.ownership, "creator"),
        eq(channels.role, "live-ingest"),
      ),
    );

  if (!channel) {
    return err(
      new AppError(
        "TEST_CONTROL_SEED_MISSING",
        "Maya creator-programming channel is not seeded",
        409,
      ),
    );
  }

  const [studioTour] = await db
    .select({ id: content.id })
    .from(content)
    .where(
      and(
        eq(content.id, STUDIO_TOUR_CONTENT_ID),
        eq(content.creatorId, MAYA_CREATOR_ID),
      ),
    );

  if (!studioTour) {
    return err(
      new AppError(
        "TEST_CONTROL_SEED_MISSING",
        "Maya Studio Tour content is not seeded",
        409,
      ),
    );
  }

  return ok(undefined);
};

// ── Public API ──

/**
 * Remove Maya creator-programming rows that make pool-mutating e2e specs order-dependent.
 *
 * Deletes prefixed deterministic test-control rows plus any prior UI-created pool/queue rows
 * for the same demo channel/content pair. Queue rows go first to satisfy FK constraints and
 * mirror the integration-suite cleanup pattern.
 */
export const resetMayaCreatorProgramming = async (): Promise<
  Result<MayaProgrammingState, AppError>
> => {
  const verified = await verifyMayaDemoRows();
  if (!verified.ok) return verified;

  await db
    .delete(playoutQueue)
    .where(
      and(
        eq(playoutQueue.channelId, MAYA_CHANNEL_ID),
        or(
          eq(playoutQueue.contentId, STUDIO_TOUR_CONTENT_ID),
          like(playoutQueue.id, `${TEST_CONTROL_PREFIX}-%`),
        ),
      ),
    );

  await db
    .delete(channelContent)
    .where(
      and(
        eq(channelContent.channelId, MAYA_CHANNEL_ID),
        or(
          eq(channelContent.contentId, STUDIO_TOUR_CONTENT_ID),
          like(channelContent.id, `${TEST_CONTROL_PREFIX}-%`),
        ),
      ),
    );

  return ok({
    channelId: MAYA_CHANNEL_ID,
    creatorId: MAYA_CREATOR_ID,
    contentId: STUDIO_TOUR_CONTENT_ID,
    seededPool: false,
    seededQueue: false,
  });
};

/** Reset Maya programming state, then optionally seed a deterministic pool/queue fixture. */
export const seedMayaCreatorProgramming = async (
  options: MayaProgrammingSeedOptions = {},
): Promise<Result<MayaProgrammingState, AppError>> => {
  const reset = await resetMayaCreatorProgramming();
  if (!reset.ok) return reset;

  const seedPool = options.pool ?? true;
  const seedQueue = options.queue ?? false;

  if (seedQueue && !seedPool) {
    return err(
      new AppError(
        "TEST_CONTROL_INVALID_SEED",
        "Cannot seed queue without seeding the content pool",
        400,
      ),
    );
  }

  if (seedPool) {
    await db.insert(channelContent).values({
      id: MAYA_POOL_ROW_ID,
      channelId: MAYA_CHANNEL_ID,
      contentId: STUDIO_TOUR_CONTENT_ID,
      playoutItemId: null,
    });
  }

  if (seedQueue) {
    await enqueue({
      id: MAYA_QUEUE_ROW_ID,
      channelId: MAYA_CHANNEL_ID,
      source: { contentId: STUDIO_TOUR_CONTENT_ID },
      position: DEFAULT_QUEUE_POSITION,
    });
  }

  return ok({
    channelId: MAYA_CHANNEL_ID,
    creatorId: MAYA_CREATOR_ID,
    contentId: STUDIO_TOUR_CONTENT_ID,
    seededPool: seedPool,
    seededQueue: seedQueue,
  });
};
