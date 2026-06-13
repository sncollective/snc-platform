/**
 * Integration test: persistent creator channel lifecycle.
 *
 * Verifies that the publish→unpublish→publish cycle reuses the SAME channel
 * row (no temp-row churn), that the chat room survives across sessions, and
 * that duplicate channel rows per creator are deduped to one.
 *
 * Requires: real dev DB (PostgreSQL) accessible via DATABASE_URL in .env.
 * Run with: bun run test:integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";

afterEach(() => {
  vi.resetModules();
});

describe("creator channel lifecycle (persistent row model)", () => {
  /**
   * publish→unpublish→publish reuse.
   *
   * Core acceptance criterion: a creator who publishes, stops, then publishes
   * again gets the SAME channel row — the channel ID is identical in both
   * activate calls.
   */
  it("reuses the same channel row across publish/unpublish/publish cycles", async () => {
    const { db } = await import("../../../src/db/connection.js");
    const { channels } = await import("../../../src/db/schema/streaming.schema.js");
    const { ensureCreatorChannel, activateLiveChannel, deactivateLiveChannel } =
      await import("../../../src/services/channels.js");
    const { eq, and } = await import("drizzle-orm");

    const creatorId = `test-creator-${randomUUID()}`;
    const channelName = "Test Creator";

    // Provision a persistent channel (what createStreamKey does)
    const provisionResult = await ensureCreatorChannel(creatorId, channelName);
    expect(provisionResult.ok).toBe(true);
    const provisionedChannelId = provisionResult.ok ? provisionResult.value.channelId : null;
    expect(provisionedChannelId).toBeTruthy();

    try {
      // First publish
      const session1 = `session-${randomUUID()}`;
      const activate1 = await activateLiveChannel({
        creatorId,
        creatorName: channelName,
        streamSessionId: session1,
        srsStreamName: "creator-livestream",
      });
      expect(activate1.ok).toBe(true);
      const channelId1 = activate1.ok ? activate1.value.channelId : null;
      expect(channelId1).toBe(provisionedChannelId);

      // Verify active
      const [activeRow] = await db
        .select({ id: channels.id, isActive: channels.isActive, streamSessionId: channels.streamSessionId })
        .from(channels)
        .where(eq(channels.id, channelId1!));
      expect(activeRow?.isActive).toBe(true);
      expect(activeRow?.streamSessionId).toBe(session1);

      // Unpublish
      const deactivate = await deactivateLiveChannel(session1);
      expect(deactivate.ok).toBe(true);

      // Verify deactivated but NOT deleted
      const [afterUnpublish] = await db
        .select({ id: channels.id, isActive: channels.isActive })
        .from(channels)
        .where(eq(channels.id, channelId1!));
      expect(afterUnpublish).toBeDefined(); // row still exists
      expect(afterUnpublish?.isActive).toBe(false);

      // Second publish (same creator, new session)
      const session2 = `session-${randomUUID()}`;
      const activate2 = await activateLiveChannel({
        creatorId,
        creatorName: channelName,
        streamSessionId: session2,
        srsStreamName: "creator-livestream",
      });
      expect(activate2.ok).toBe(true);
      const channelId2 = activate2.ok ? activate2.value.channelId : null;

      // THE CORE ASSERTION: same channel row, no new row created
      expect(channelId2).toBe(channelId1);

      // Verify active again with new session
      const [reactivatedRow] = await db
        .select({ isActive: channels.isActive, streamSessionId: channels.streamSessionId })
        .from(channels)
        .where(eq(channels.id, channelId2!));
      expect(reactivatedRow?.isActive).toBe(true);
      expect(reactivatedRow?.streamSessionId).toBe(session2);

      // Exactly one channel row exists for this creator
      const allRows = await db
        .select({ id: channels.id })
        .from(channels)
        .where(
          and(
            eq(channels.creatorId, creatorId),
            eq(channels.ownership, "creator"),
            eq(channels.role, "live-ingest"),
          ),
        );
      expect(allRows).toHaveLength(1);
    } finally {
      // Clean up test rows
      await db.delete(channels).where(eq(channels.creatorId, creatorId));
    }
  });

  /**
   * ensureCreatorChannel is idempotent.
   *
   * Calling it multiple times for the same creator must always return the
   * same channel ID and never insert more than one row.
   */
  it("ensureCreatorChannel is idempotent — same row on repeated calls", async () => {
    const { db } = await import("../../../src/db/connection.js");
    const { channels } = await import("../../../src/db/schema/streaming.schema.js");
    const { ensureCreatorChannel } = await import("../../../src/services/channels.js");
    const { eq, and } = await import("drizzle-orm");

    const creatorId = `test-creator-${randomUUID()}`;

    try {
      const result1 = await ensureCreatorChannel(creatorId, "Creator One");
      expect(result1.ok).toBe(true);
      const id1 = result1.ok ? result1.value.channelId : null;

      const result2 = await ensureCreatorChannel(creatorId, "Creator One");
      expect(result2.ok).toBe(true);
      const id2 = result2.ok ? result2.value.channelId : null;

      expect(id1).toBe(id2);

      const rows = await db
        .select({ id: channels.id })
        .from(channels)
        .where(
          and(
            eq(channels.creatorId, creatorId),
            eq(channels.ownership, "creator"),
            eq(channels.role, "live-ingest"),
          ),
        );
      expect(rows).toHaveLength(1);
    } finally {
      await db.delete(channels).where(eq(channels.creatorId, creatorId));
    }
  });

  /**
   * Duplicate temp rows deduped.
   *
   * If a creator somehow has multiple `creator`/`live-ingest` rows (from the
   * old temp-row backfill), ensureCreatorChannel dedupes them to one.
   */
  it("dedupes duplicate creator live-ingest rows on ensureCreatorChannel", async () => {
    const { db } = await import("../../../src/db/connection.js");
    const { channels } = await import("../../../src/db/schema/streaming.schema.js");
    const { ensureCreatorChannel } = await import("../../../src/services/channels.js");
    const { eq, and } = await import("drizzle-orm");

    const creatorId = `test-creator-${randomUUID()}`;
    const olderChannelId = `ch-${randomUUID()}`;
    const newerChannelId = `ch-${randomUUID()}`;

    try {
      // Directly insert two duplicate rows to simulate the backfill situation
      await db.insert(channels).values({
        id: olderChannelId,
        name: "Old Channel",
        ownership: "creator",
        role: "live-ingest",
        srsStreamName: `creator-old-${creatorId}`,
        creatorId,
        isActive: false,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      });
      await db.insert(channels).values({
        id: newerChannelId,
        name: "New Channel",
        ownership: "creator",
        role: "live-ingest",
        srsStreamName: `creator-new-${creatorId}`,
        creatorId,
        isActive: false,
        createdAt: new Date("2026-06-01T00:00:00Z"),
      });

      // ensureCreatorChannel should dedupe to the oldest row
      const result = await ensureCreatorChannel(creatorId, "Creator");
      expect(result.ok).toBe(true);
      const canonicalId = result.ok ? result.value.channelId : null;
      expect(canonicalId).toBe(olderChannelId);

      // Only one row should remain
      const rows = await db
        .select({ id: channels.id })
        .from(channels)
        .where(
          and(
            eq(channels.creatorId, creatorId),
            eq(channels.ownership, "creator"),
            eq(channels.role, "live-ingest"),
          ),
        );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(olderChannelId);
    } finally {
      await db.delete(channels).where(eq(channels.creatorId, creatorId));
    }
  });
});
