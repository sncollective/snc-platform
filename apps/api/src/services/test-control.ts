import { and, eq, like, or } from "drizzle-orm";
import { AppError, ok, err } from "@snc/shared";
import type { Result } from "@snc/shared";

import { db } from "../db/connection.js";
import { content } from "../db/schema/content.schema.js";
import { channelContent, playoutQueue } from "../db/schema/playout-queue.schema.js";
import { channels } from "../db/schema/streaming.schema.js";
import { config } from "../config.js";
import { regenerateAndRestart, waitForHealth } from "./liquidsoap-config.js";
import { enqueue } from "./playout-queue-transitions.js";
import { orchestrator } from "../routes/playout-channels.init.js";

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
  fixtureId?: string | undefined;
  title?: string | undefined;
  timestampIso?: string | undefined;
  channelActive?: boolean | undefined;
  syncPlaybackEngine?: boolean | undefined;
};

export type MayaProgrammingState = {
  channelId: string;
  creatorId: string;
  contentId: string;
  title: string;
  fixtureId: string | null;
  seededPool: boolean;
  seededQueue: boolean;
  channelActive: boolean;
  playbackEngineSynced: boolean;
};

// ── Private Helpers ──

const fixtureContentId = (fixtureId: string): string =>
  `${TEST_CONTROL_PREFIX}-content-${fixtureId}`;

const fixturePoolRowId = (fixtureId: string): string =>
  `${TEST_CONTROL_PREFIX}-pool-${fixtureId}`;

const fixtureQueueRowId = (fixtureId: string): string =>
  `${TEST_CONTROL_PREFIX}-queue-${fixtureId}`;

const fixtureSlug = (fixtureId: string): string => `${TEST_CONTROL_PREFIX}-${fixtureId}`;

const assertValidFixtureId = (fixtureId: string): Result<void, AppError> => {
  if (/^[a-z0-9][a-z0-9-]{2,120}$/.test(fixtureId)) return ok(undefined);

  return err(
    new AppError(
      "TEST_CONTROL_INVALID_FIXTURE",
      "Maya programming fixtureId must be a stable lowercase slug",
      400,
    ),
  );
};

const resolveFixture = (options: MayaProgrammingSeedOptions = {}) => {
  const fixtureId = options.fixtureId;
  const title = options.title ?? "Studio Tour 2026";

  if (!fixtureId) {
    return {
      fixtureId: null,
      contentId: STUDIO_TOUR_CONTENT_ID,
      poolRowId: MAYA_POOL_ROW_ID,
      queueRowId: MAYA_QUEUE_ROW_ID,
      title,
    };
  }

  return {
    fixtureId,
    contentId: fixtureContentId(fixtureId),
    poolRowId: fixturePoolRowId(fixtureId),
    queueRowId: fixtureQueueRowId(fixtureId),
    title,
  };
};

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

const setMayaChannelActive = async (isActive: boolean): Promise<void> => {
  await db
    .update(channels)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(channels.id, MAYA_CHANNEL_ID));
};

/**
 * Poll Maya's creator-channel harbor now-playing endpoint until a handler is
 * registered (any 2xx or 4xx with a JSON/XHTML harbor body, NOT a connection
 * reset or 404 "page not available"). Returns true once the handler is live.
 */
const waitForMayaChannelHarbor = async (
  maxAttempts: number,
  intervalMs: number,
): Promise<boolean> => {
  const baseUrl = config.LIQUIDSOAP_API_URL;
  if (!baseUrl) return true;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(
        `${baseUrl}/channels/${MAYA_CHANNEL_ID}/now-playing`,
        { signal: AbortSignal.timeout(1_500) },
      );
      // A registered handler returns 200 with JSON; an unregistered harbor path
      // returns 404 with an XHTML "page not available" body. Connection reset /
      // ECONNREFUSED means the process is still restarting.
      if (res.ok) return true;
    } catch {
      // still restarting or handler not registered yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
};

const syncPlaybackEngine = async (
  options: { expectChannelActive?: boolean } = {},
): Promise<Result<void, AppError>> => {
  const restart = await regenerateAndRestart();
  if (!restart.ok) return restart;

  const healthy = await waitForHealth(15, 2_000);
  if (!healthy) {
    return err(
      new AppError(
        "TEST_CONTROL_PLAYBACK_ENGINE_UNHEALTHY",
        "Liquidsoap did not become healthy after playback test-control sync",
        502,
      ),
    );
  }

  // The /health endpoint can respond before Liquidsoap has finished registering
  // the per-channel harbor handlers after a restart — the orchestrator's
  // prefetch push would then 404 and leave queued content unpushed (the
  // nowPlaying-never-promotes race). When the channel is being activated for a
  // playback proof, poll Maya's channel harbor endpoint until a handler is
  // registered before initializing the orchestrator. Skip this when
  // deactivating: the handler is intentionally absent for an inactive channel.
  if (options.expectChannelActive) {
    const harborReady = await waitForMayaChannelHarbor(20, 500);
    if (!harborReady) {
      return err(
        new AppError(
          "TEST_CONTROL_PLAYBACK_HARBOR_NOT_READY",
          "Liquidsoap harbor handlers were not registered for Maya's channel after restart",
          502,
        ),
      );
    }
  }

  await orchestrator.initialize();
  return ok(undefined);
};

// ── Public API ──

/**
 * Remove Maya creator-programming rows that make pool-mutating e2e specs order-dependent.
 *
 * Without a fixtureId, deletes prefixed deterministic test-control rows plus any prior
 * UI-created pool/queue rows for the original demo Studio Tour content. With a fixtureId,
 * cleanup is scoped to that deterministic content/pool/queue fixture so parallel e2e
 * workers do not delete each other's state. Queue rows go first to satisfy FK constraints.
 */
export const resetMayaCreatorProgramming = async (
  options: Pick<
    MayaProgrammingSeedOptions,
    "fixtureId" | "title" | "channelActive" | "syncPlaybackEngine"
  > = {},
): Promise<Result<MayaProgrammingState, AppError>> => {
  const verified = await verifyMayaDemoRows();
  if (!verified.ok) return verified;

  if (options.fixtureId) {
    const validFixture = assertValidFixtureId(options.fixtureId);
    if (!validFixture.ok) return validFixture;
  }

  const fixture = resolveFixture(options);
  const queuePredicate = fixture.fixtureId
    ? or(
        eq(playoutQueue.contentId, fixture.contentId),
        eq(playoutQueue.id, fixture.queueRowId),
      )
    : or(
        eq(playoutQueue.contentId, STUDIO_TOUR_CONTENT_ID),
        like(playoutQueue.id, `${TEST_CONTROL_PREFIX}-%`),
      );
  const poolPredicate = fixture.fixtureId
    ? or(
        eq(channelContent.contentId, fixture.contentId),
        eq(channelContent.id, fixture.poolRowId),
      )
    : or(
        eq(channelContent.contentId, STUDIO_TOUR_CONTENT_ID),
        like(channelContent.id, `${TEST_CONTROL_PREFIX}-%`),
      );

  await db
    .delete(playoutQueue)
    .where(and(eq(playoutQueue.channelId, MAYA_CHANNEL_ID), queuePredicate));

  await db
    .delete(channelContent)
    .where(and(eq(channelContent.channelId, MAYA_CHANNEL_ID), poolPredicate));

  if (fixture.fixtureId) {
    await db.delete(content).where(eq(content.id, fixture.contentId));
  } else {
    await db.delete(content).where(like(content.id, `${TEST_CONTROL_PREFIX}-content-%`));
  }

  if (options.channelActive !== undefined) {
    await setMayaChannelActive(options.channelActive);
  }

  if (options.syncPlaybackEngine) {
    const synced = await syncPlaybackEngine({
      expectChannelActive: options.channelActive ?? false,
    });
    if (!synced.ok) return synced;
  }

  return ok({
    channelId: MAYA_CHANNEL_ID,
    creatorId: MAYA_CREATOR_ID,
    contentId: fixture.contentId,
    title: fixture.title,
    fixtureId: fixture.fixtureId,
    seededPool: false,
    seededQueue: false,
    channelActive: options.channelActive ?? false,
    playbackEngineSynced: options.syncPlaybackEngine ?? false,
  });
};

/** Reset Maya programming state, then optionally seed a deterministic pool/queue fixture. */
export const seedMayaCreatorProgramming = async (
  options: MayaProgrammingSeedOptions = {},
): Promise<Result<MayaProgrammingState, AppError>> => {
  const reset = await resetMayaCreatorProgramming({
    ...options,
    syncPlaybackEngine: false,
  });
  if (!reset.ok) return reset;

  const seedPool = options.pool ?? true;
  const seedQueue = options.queue ?? false;
  const fixture = resolveFixture(options);

  if (seedQueue && !seedPool) {
    return err(
      new AppError(
        "TEST_CONTROL_INVALID_SEED",
        "Cannot seed queue without seeding the content pool",
        400,
      ),
    );
  }

  if (fixture.fixtureId) {
    const timestamp = options.timestampIso
      ? new Date(options.timestampIso)
      : new Date();
    await db.insert(content).values({
      id: fixture.contentId,
      creatorId: MAYA_CREATOR_ID,
      type: "video",
      title: fixture.title,
      slug: fixtureSlug(fixture.fixtureId),
      description: "Deterministic e2e creator-programming fixture.",
      visibility: "public",
      sourceType: "upload",
      mediaKey: `content/${fixture.contentId}/media/studio-tour.mp4`,
      thumbnailKey: `content/${fixture.contentId}/thumbnail/thumb.jpg`,
      publishedAt: timestamp,
      processingStatus: "ready",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  if (seedPool) {
    await db.insert(channelContent).values({
      id: fixture.poolRowId,
      channelId: MAYA_CHANNEL_ID,
      contentId: fixture.contentId,
      playoutItemId: null,
    });
  }

  if (seedQueue) {
    await enqueue({
      id: fixture.queueRowId,
      channelId: MAYA_CHANNEL_ID,
      source: { contentId: fixture.contentId },
      position: DEFAULT_QUEUE_POSITION,
    });
  }

  if (options.syncPlaybackEngine) {
    const synced = await syncPlaybackEngine({
      expectChannelActive: options.channelActive ?? false,
    });
    if (!synced.ok) return synced;
  }

  return ok({
    channelId: MAYA_CHANNEL_ID,
    creatorId: MAYA_CREATOR_ID,
    contentId: fixture.contentId,
    title: fixture.title,
    fixtureId: fixture.fixtureId,
    seededPool: seedPool,
    seededQueue: seedQueue,
    channelActive: options.channelActive ?? false,
    playbackEngineSynced: options.syncPlaybackEngine ?? false,
  });
};
