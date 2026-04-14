import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { and, eq } from "drizzle-orm";

import { db } from "../../../src/db/connection.js";
import { playoutQueue } from "../../../src/db/schema/playout-queue.schema.js";
import { channels } from "../../../src/db/schema/streaming.schema.js";
import { playoutItems } from "../../../src/db/schema/playout.schema.js";
import { handlePlayoutQueueCleanup } from "../../../src/jobs/handlers/playout-queue-cleanup.js";

// ── Test fixtures ──

const TEST_CHANNEL_A = "test-cleanup-channel-a";
const TEST_CHANNEL_B = "test-cleanup-channel-b";
const TEST_ITEM = "test-cleanup-item";

const seedTestChannel = async (id: string): Promise<void> => {
  await db.insert(channels).values({
    id,
    name: `Test Cleanup ${id}`,
    type: "playout",
    srsStreamName: id,
    isActive: true,
  });
};

const seedTestItem = async (): Promise<void> => {
  await db.insert(playoutItems).values({
    id: TEST_ITEM,
    title: "Test Item",
    s3KeyPrefix: "test/",
    processingStatus: "ready",
    position: 0,
  });
};

const seedPlayedRows = async (
  channelId: string,
  count: number,
  startPosition = 1,
): Promise<void> => {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: `${channelId}-played-${startPosition + i}`,
    channelId,
    playoutItemId: TEST_ITEM,
    position: startPosition + i,
    status: "played",
    pushedToLiquidsoap: true,
  }));
  await db.insert(playoutQueue).values(rows);
};

const countPlayed = async (channelId: string): Promise<number> => {
  const rows = await db
    .select({ id: playoutQueue.id })
    .from(playoutQueue)
    .where(
      and(eq(playoutQueue.channelId, channelId), eq(playoutQueue.status, "played")),
    );
  return rows.length;
};

// ── Tests ──

describe("handlePlayoutQueueCleanup (integration)", () => {
  beforeEach(async () => {
    // Clean slate: delete any leftover test fixtures from prior runs
    await db
      .delete(playoutQueue)
      .where(eq(playoutQueue.channelId, TEST_CHANNEL_A));
    await db
      .delete(playoutQueue)
      .where(eq(playoutQueue.channelId, TEST_CHANNEL_B));
    await db.delete(channels).where(eq(channels.id, TEST_CHANNEL_A));
    await db.delete(channels).where(eq(channels.id, TEST_CHANNEL_B));
    await db.delete(playoutItems).where(eq(playoutItems.id, TEST_ITEM));

    await seedTestItem();
    await seedTestChannel(TEST_CHANNEL_A);
    await seedTestChannel(TEST_CHANNEL_B);
  });

  afterEach(async () => {
    await db
      .delete(playoutQueue)
      .where(eq(playoutQueue.channelId, TEST_CHANNEL_A));
    await db
      .delete(playoutQueue)
      .where(eq(playoutQueue.channelId, TEST_CHANNEL_B));
    await db.delete(channels).where(eq(channels.id, TEST_CHANNEL_A));
    await db.delete(channels).where(eq(channels.id, TEST_CHANNEL_B));
    await db.delete(playoutItems).where(eq(playoutItems.id, TEST_ITEM));
  });

  it("keeps exactly the cap when a channel has more played rows than the cap", async () => {
    await seedPlayedRows(TEST_CHANNEL_A, 150);

    const deleted = await handlePlayoutQueueCleanup();

    // deleted >= 50: the test channel contributes 50; other dev-DB channels may add more
    expect(deleted).toBeGreaterThanOrEqual(50);
    expect(await countPlayed(TEST_CHANNEL_A)).toBe(100);
  });

  it("keeps the most recent rows (highest position) when trimming", async () => {
    await seedPlayedRows(TEST_CHANNEL_A, 150);

    await handlePlayoutQueueCleanup();

    // After cleanup, the surviving rows should be positions 51..150
    const surviving = await db
      .select({ position: playoutQueue.position })
      .from(playoutQueue)
      .where(
        and(
          eq(playoutQueue.channelId, TEST_CHANNEL_A),
          eq(playoutQueue.status, "played"),
        ),
      );
    const positions = surviving.map((r) => r.position).sort((a, b) => a - b);
    expect(positions[0]).toBe(51);
    expect(positions[positions.length - 1]).toBe(150);
  });

  it("does nothing for a channel at or below the cap", async () => {
    await seedPlayedRows(TEST_CHANNEL_A, 100);

    const beforeCount = await countPlayed(TEST_CHANNEL_A);
    await handlePlayoutQueueCleanup();

    // The test channel's rows should be untouched (still at cap)
    expect(await countPlayed(TEST_CHANNEL_A)).toBe(beforeCount);
  });

  it("does nothing when no played rows exist", async () => {
    // Verify test channels start empty (no played rows seeded)
    const before = await countPlayed(TEST_CHANNEL_A);
    expect(before).toBe(0);

    await handlePlayoutQueueCleanup();

    expect(await countPlayed(TEST_CHANNEL_A)).toBe(0);
  });

  it("trims multiple channels independently", async () => {
    await seedPlayedRows(TEST_CHANNEL_A, 130);
    await seedPlayedRows(TEST_CHANNEL_B, 110);

    const deleted = await handlePlayoutQueueCleanup();

    // deleted >= 40: test channels contribute 30 + 10; other dev-DB channels may add more
    expect(deleted).toBeGreaterThanOrEqual(40);
    expect(await countPlayed(TEST_CHANNEL_A)).toBe(100);
    expect(await countPlayed(TEST_CHANNEL_B)).toBe(100);
  });

  it("does not touch queued or playing rows", async () => {
    await seedPlayedRows(TEST_CHANNEL_A, 150);
    await db.insert(playoutQueue).values([
      {
        id: `${TEST_CHANNEL_A}-queued`,
        channelId: TEST_CHANNEL_A,
        playoutItemId: TEST_ITEM,
        position: 200,
        status: "queued",
        pushedToLiquidsoap: false,
      },
      {
        id: `${TEST_CHANNEL_A}-playing`,
        channelId: TEST_CHANNEL_A,
        playoutItemId: TEST_ITEM,
        position: 201,
        status: "playing",
        pushedToLiquidsoap: true,
      },
    ]);

    await handlePlayoutQueueCleanup();

    const nonPlayed = await db
      .select({ id: playoutQueue.id, status: playoutQueue.status })
      .from(playoutQueue)
      .where(eq(playoutQueue.channelId, TEST_CHANNEL_A));
    const statuses = nonPlayed.map((r) => r.status).sort();
    expect(statuses).toContain("queued");
    expect(statuses).toContain("playing");
  });
});
