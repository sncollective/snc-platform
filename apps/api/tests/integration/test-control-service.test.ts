import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";

import {
  resetMayaCreatorProgramming,
  seedMayaCreatorProgramming,
} from "../../src/services/test-control.js";
import { db } from "../../src/db/connection.js";
import { channelContent, playoutQueue } from "../../src/db/schema/playout-queue.schema.js";

const MAYA_CHANNEL_ID = "00000000-0000-4000-c000-000000000001";
const STUDIO_TOUR_CONTENT_ID = "00000000-0000-4000-a000-000000000103";
const POOL_ROW_ID = "e2e-tc-maya-programming-pool-studio-tour";
const QUEUE_ROW_ID = "e2e-tc-maya-programming-queue-studio-tour";

describe("test-control service", () => {
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

  it("rejects queue-only seeds because queue entries require a pool row", async () => {
    const result = await seedMayaCreatorProgramming({ pool: false, queue: true });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("TEST_CONTROL_INVALID_SEED");
    expect(result.error.statusCode).toBe(400);
  });
});
