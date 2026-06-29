import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";

import {
  resetMayaCreatorProgramming,
  seedMayaCreatorProgramming,
} from "../../src/services/test-control.js";
import { db } from "../../src/db/connection.js";
import { content } from "../../src/db/schema/content.schema.js";
import { creatorProfiles } from "../../src/db/schema/creator.schema.js";
import { channelContent, playoutQueue } from "../../src/db/schema/playout-queue.schema.js";
import { channels } from "../../src/db/schema/streaming.schema.js";

const MAYA_CREATOR_ID = "00000000-0000-4000-a000-000000000002";
const MAYA_CHANNEL_ID = "00000000-0000-4000-c000-000000000001";
const STUDIO_TOUR_CONTENT_ID = "00000000-0000-4000-a000-000000000103";
const POOL_ROW_ID = "e2e-tc-maya-programming-pool-studio-tour";
const QUEUE_ROW_ID = "e2e-tc-maya-programming-queue-studio-tour";
const FIXTURE_A_ID = "creator-programming-chromium-studio-tour-a";
const FIXTURE_B_ID = "creator-programming-mobile-studio-tour-b";
const fixtureContentId = (fixtureId: string) =>
  `e2e-tc-maya-programming-content-${fixtureId}`;
const fixturePoolRowId = (fixtureId: string) =>
  `e2e-tc-maya-programming-pool-${fixtureId}`;

const ensureMayaDemoRows = async (): Promise<void> => {
  const now = new Date();

  await db
    .insert(creatorProfiles)
    .values({
      id: MAYA_CREATOR_ID,
      displayName: "Maya Chen",
      handle: "maya-chen",
    })
    .onConflictDoNothing();

  await db
    .insert(channels)
    .values({
      id: MAYA_CHANNEL_ID,
      name: "Maya Chen's Stream",
      ownership: "creator",
      role: "live-ingest",
      srsStreamName: "creator-maya-chen",
      creatorId: MAYA_CREATOR_ID,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  await db
    .insert(content)
    .values({
      id: STUDIO_TOUR_CONTENT_ID,
      creatorId: MAYA_CREATOR_ID,
      type: "video",
      title: "Studio Tour 2026",
      slug: "studio-tour-2026",
      visibility: "public",
      sourceType: "upload",
      processingStatus: "ready",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
};

describe("test-control service", () => {
  beforeAll(async () => {
    await ensureMayaDemoRows();
  });

  beforeEach(async () => {
    await resetMayaCreatorProgramming();
  });

  afterEach(async () => {
    await resetMayaCreatorProgramming();
  });

  it("seeds Maya creator-programming rows with deterministic IDs, then resets them", async () => {
    const seeded = await seedMayaCreatorProgramming({ pool: true, queue: true });
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) return;
    expect(seeded.value).toMatchObject({
      channelId: MAYA_CHANNEL_ID,
      contentId: STUDIO_TOUR_CONTENT_ID,
      seededPool: true,
      seededQueue: true,
    });

    const poolRows = await db
      .select()
      .from(channelContent)
      .where(eq(channelContent.id, POOL_ROW_ID));
    expect(poolRows).toHaveLength(1);
    expect(poolRows[0]).toMatchObject({
      channelId: MAYA_CHANNEL_ID,
      contentId: STUDIO_TOUR_CONTENT_ID,
      playoutItemId: null,
    });

    const queueRows = await db
      .select()
      .from(playoutQueue)
      .where(eq(playoutQueue.id, QUEUE_ROW_ID));
    expect(queueRows).toHaveLength(1);
    expect(queueRows[0]).toMatchObject({
      channelId: MAYA_CHANNEL_ID,
      contentId: STUDIO_TOUR_CONTENT_ID,
      playoutItemId: null,
      position: 1,
      status: "queued",
    });

    const reset = await resetMayaCreatorProgramming();
    expect(reset.ok).toBe(true);

    const remainingPoolRows = await db
      .select()
      .from(channelContent)
      .where(eq(channelContent.id, POOL_ROW_ID));
    const remainingQueueRows = await db
      .select()
      .from(playoutQueue)
      .where(eq(playoutQueue.id, QUEUE_ROW_ID));
    expect(remainingPoolRows).toHaveLength(0);
    expect(remainingQueueRows).toHaveLength(0);
  });

  it("scopes deterministic fixture cleanup so parallel e2e cases do not delete each other", async () => {
    const timestampIso = "2026-01-15T12:00:00.000Z";
    const fixtureA = await seedMayaCreatorProgramming({
      fixtureId: FIXTURE_A_ID,
      title: "Studio Tour fixture A",
      pool: true,
      timestampIso,
    });
    const fixtureB = await seedMayaCreatorProgramming({
      fixtureId: FIXTURE_B_ID,
      title: "Studio Tour fixture B",
      pool: true,
      timestampIso,
    });
    expect(fixtureA.ok).toBe(true);
    expect(fixtureB.ok).toBe(true);

    const resetA = await resetMayaCreatorProgramming({ fixtureId: FIXTURE_A_ID });
    expect(resetA.ok).toBe(true);

    const deletedAContent = await db
      .select()
      .from(content)
      .where(eq(content.id, fixtureContentId(FIXTURE_A_ID)));
    const remainingBContent = await db
      .select()
      .from(content)
      .where(eq(content.id, fixtureContentId(FIXTURE_B_ID)));
    const remainingBPool = await db
      .select()
      .from(channelContent)
      .where(eq(channelContent.id, fixturePoolRowId(FIXTURE_B_ID)));

    expect(deletedAContent).toHaveLength(0);
    expect(remainingBContent).toHaveLength(1);
    expect(remainingBPool).toHaveLength(1);
  });

  it("rejects queue-only seeds because queue entries require a pool row", async () => {
    const result = await seedMayaCreatorProgramming({ pool: false, queue: true });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("TEST_CONTROL_INVALID_SEED");
    expect(result.error.statusCode).toBe(400);
  });
});
