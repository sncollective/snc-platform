/**
 * Integration test: cross-tenant isolation for creator editorial routes.
 *
 * Proves the three content-leak regressions caught in review are closed against
 * REAL SQL — unit tests (mocked DB) can't catch a query that is wrong against
 * actual rows. Service-layer approach (not route-level) matches the existing
 * integration harness: real Postgres, real imports, no vi.mock.
 *
 * Guarantees asserted:
 *
 *  1. Content search is creator-scoped — userA's channel search returns only
 *     creatorA's content, never creatorB's content.
 *  2. Cross-creator assign rejected — assigning creatorB's contentId to
 *     creatorA's channel returns ForbiddenError and writes nothing.
 *  3. Own-content assign succeeds — assigning creatorA's contentId succeeds and
 *     the row appears in channel_content.
 *  4. Queue-insert pool chokepoint — inserting a playoutItemId NOT in the
 *     channel's pool is rejected as ForbiddenError.
 *  5. Cross-creator permission denied — requireCreatorPermission throws when a
 *     user is not a member of the target creator.
 *  6. Fail-closed — a bogus channelId resolves to NotFoundError, never admin scope.
 *  7. Soft-deleted content excluded — a deleted content row is not surfaced by
 *     search and cannot be assigned.
 *
 * Requires: real dev DB (PostgreSQL) accessible via DATABASE_URL in .env.
 * Run with: bash scripts/dev/sandbox-test-integration.sh
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";

// ── Isolation note ──
// vi.resetModules() is NOT used here because we test service functions, not the
// app singleton. The integration harness uses process isolation (pool: "forks")
// so there is no cross-file singleton bleed.

afterEach(() => {
  vi.resetModules();
});

// ── Stable test IDs ──
// Prefixed so they can be deleted in cleanup even if a test fails partway.
const PREFIX = "test-xtn"; // cross-tenant-isolation
const CREATOR_A_ID = `${PREFIX}-creator-a`;
const CREATOR_B_ID = `${PREFIX}-creator-b`;
const USER_A_ID = `${PREFIX}-user-a`;
const USER_B_ID = `${PREFIX}-user-b`;
const CHANNEL_A_ID = `${PREFIX}-channel-a`;
const CHANNEL_B_ID = `${PREFIX}-channel-b`;
const CONTENT_A1_ID = `${PREFIX}-content-a1`;
const CONTENT_A2_ID = `${PREFIX}-content-a2`;
const CONTENT_A_DELETED_ID = `${PREFIX}-content-a-del`;
const CONTENT_B1_ID = `${PREFIX}-content-b1`;
const PLAYOUT_ITEM_ID = `${PREFIX}-playout-item`;

// ── Cleanup helper ──
// Deletes in FK-safe order: queue → channel_content → content → channels →
// creator_members → creator_profiles → users.
// Called both in beforeEach (clean slate) and afterEach (leave no traces).
const cleanupFixtures = async (): Promise<void> => {
  const { db } = await import("../../../src/db/connection.js");
  const { playoutQueue, channelContent } = await import(
    "../../../src/db/schema/playout-queue.schema.js"
  );
  const { channels } = await import(
    "../../../src/db/schema/streaming.schema.js"
  );
  const { content } = await import(
    "../../../src/db/schema/content.schema.js"
  );
  const { creatorMembers, creatorProfiles } = await import(
    "../../../src/db/schema/creator.schema.js"
  );
  const { users } = await import("../../../src/db/schema/user.schema.js");
  const { playoutItems } = await import(
    "../../../src/db/schema/playout.schema.js"
  );
  const { inArray } = await import("drizzle-orm");

  // Delete child rows first to respect FK constraints
  await db
    .delete(playoutQueue)
    .where(inArray(playoutQueue.channelId, [CHANNEL_A_ID, CHANNEL_B_ID]));
  await db
    .delete(channelContent)
    .where(inArray(channelContent.channelId, [CHANNEL_A_ID, CHANNEL_B_ID]));
  await db
    .delete(content)
    .where(
      inArray(content.id, [
        CONTENT_A1_ID,
        CONTENT_A2_ID,
        CONTENT_A_DELETED_ID,
        CONTENT_B1_ID,
      ]),
    );
  await db.delete(playoutItems).where(inArray(playoutItems.id, [PLAYOUT_ITEM_ID]));
  await db
    .delete(channels)
    .where(inArray(channels.id, [CHANNEL_A_ID, CHANNEL_B_ID]));
  await db
    .delete(creatorMembers)
    .where(inArray(creatorMembers.creatorId, [CREATOR_A_ID, CREATOR_B_ID]));
  await db
    .delete(creatorProfiles)
    .where(inArray(creatorProfiles.id, [CREATOR_A_ID, CREATOR_B_ID]));
  await db
    .delete(users)
    .where(inArray(users.id, [USER_A_ID, USER_B_ID]));
};

// ── Seed helper ──
const seedFixtures = async (): Promise<void> => {
  const { db } = await import("../../../src/db/connection.js");
  const { channels } = await import(
    "../../../src/db/schema/streaming.schema.js"
  );
  const { content } = await import(
    "../../../src/db/schema/content.schema.js"
  );
  const { creatorMembers, creatorProfiles } = await import(
    "../../../src/db/schema/creator.schema.js"
  );
  const { users } = await import("../../../src/db/schema/user.schema.js");
  const { playoutItems } = await import(
    "../../../src/db/schema/playout.schema.js"
  );

  // Users (Better Auth minimum: id + name + email + createdAt + updatedAt)
  const now = new Date();
  await db.insert(users).values([
    {
      id: USER_A_ID,
      name: "Test User A",
      email: `${USER_A_ID}@snc-test.invalid`,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: USER_B_ID,
      name: "Test User B",
      email: `${USER_B_ID}@snc-test.invalid`,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // Creator profiles
  await db.insert(creatorProfiles).values([
    { id: CREATOR_A_ID, displayName: "Creator A" },
    { id: CREATOR_B_ID, displayName: "Creator B" },
  ]);

  // Memberships: userA → owner of creatorA, userB → owner of creatorB
  await db.insert(creatorMembers).values([
    { creatorId: CREATOR_A_ID, userId: USER_A_ID, role: "owner" },
    { creatorId: CREATOR_B_ID, userId: USER_B_ID, role: "owner" },
  ]);

  // Creator editorial channels (ownership='creator', role='live-ingest')
  await db.insert(channels).values([
    {
      id: CHANNEL_A_ID,
      name: "Creator A Live",
      ownership: "creator",
      role: "live-ingest",
      srsStreamName: `${CHANNEL_A_ID}-srs`,
      creatorId: CREATOR_A_ID,
      isActive: false,
    },
    {
      id: CHANNEL_B_ID,
      name: "Creator B Live",
      ownership: "creator",
      role: "live-ingest",
      srsStreamName: `${CHANNEL_B_ID}-srs`,
      creatorId: CREATOR_B_ID,
      isActive: false,
    },
  ]);

  // Content: A owns A1 + A2 + a deleted row; B owns B1
  await db.insert(content).values([
    {
      id: CONTENT_A1_ID,
      creatorId: CREATOR_A_ID,
      type: "video",
      title: "Creator A Video 1",
      visibility: "public",
      sourceType: "upload",
      // processingStatus 'ready' is the REAL terminal state for processed content
      // (the transcode/probe pipeline writes 'ready', never 'completed'). Setting it
      // here so the suite represents production state — a fixture left at null masked
      // the search/autoFill status-filter bug (they filtered 'completed' OR IS NULL,
      // so a null row passed but a real 'ready' row was silently excluded).
      processingStatus: "ready",
      // publishedAt null, deletedAt null — available for creator search
    },
    {
      id: CONTENT_A2_ID,
      creatorId: CREATOR_A_ID,
      type: "video",
      title: "Creator A Video 2",
      visibility: "public",
      sourceType: "upload",
    },
    {
      id: CONTENT_A_DELETED_ID,
      creatorId: CREATOR_A_ID,
      type: "video",
      title: "Creator A Deleted Video",
      visibility: "public",
      sourceType: "upload",
      deletedAt: new Date("2026-01-01T00:00:00Z"),
    },
    {
      id: CONTENT_B1_ID,
      creatorId: CREATOR_B_ID,
      type: "video",
      title: "Creator B Video 1",
      visibility: "public",
      sourceType: "upload",
    },
  ]);

  // A platform playout item (for queue-pool chokepoint test)
  await db.insert(playoutItems).values({
    id: PLAYOUT_ITEM_ID,
    title: "Platform Playout Item",
    s3KeyPrefix: "playout/test/",
    processingStatus: "ready",
    position: 9999,
  });
};

// ── Tests ──

describe("creator editorial: cross-tenant isolation (real DB)", () => {
  beforeEach(async () => {
    await cleanupFixtures();
    await seedFixtures();
  });

  afterEach(async () => {
    await cleanupFixtures();
  });

  // ── Guarantee 1: Content search is creator-scoped ──────────────────────────

  it("G1: content search for creator A channel returns only A's content, never B's", async () => {
    const { createPlayoutOrchestrator } = await import(
      "../../../src/services/playout-orchestrator.js"
    );
    const { createStubLiquidsoapClient } = await import(
      "../../../src/services/liquidsoap-client.js"
    );
    const orch = createPlayoutOrchestrator(createStubLiquidsoapClient());

    const result = await orch.searchAvailableContent(CHANNEL_A_ID, "");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.value.map((r) => r.id);

    // Creator A's own active content must be reachable. CONTENT_A1 is processingStatus
    // 'ready' (the real terminal state) — this guards the search status-filter bug:
    // the filter must accept 'ready', not only 'completed'/NULL, or a creator can never
    // add their own processed video to their pool.
    expect(ids).toContain(CONTENT_A1_ID);
    expect(ids).toContain(CONTENT_A2_ID);

    // Creator B's content must NEVER appear in creator A's search
    expect(ids).not.toContain(CONTENT_B1_ID);

    // Platform playout items must not appear (creator pools are content-only)
    expect(ids).not.toContain(PLAYOUT_ITEM_ID);
  });

  // ── Guarantee 2: Cross-creator assign rejected ─────────────────────────────

  it("G2: assigning creator B's content to creator A's channel is rejected (ForbiddenError) and nothing is written", async () => {
    const { createPlayoutOrchestrator } = await import(
      "../../../src/services/playout-orchestrator.js"
    );
    const { createStubLiquidsoapClient } = await import(
      "../../../src/services/liquidsoap-client.js"
    );
    const { db } = await import("../../../src/db/connection.js");
    const { channelContent } = await import(
      "../../../src/db/schema/playout-queue.schema.js"
    );
    const { eq } = await import("drizzle-orm");
    const orch = createPlayoutOrchestrator(createStubLiquidsoapClient());

    const result = await orch.assignContent(
      CHANNEL_A_ID,
      [], // no platform playout items
      [CONTENT_B1_ID], // creatorB's content → must be rejected
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.statusCode).toBe(403);

    // Verify nothing was written to channel_content
    const rows = await db
      .select()
      .from(channelContent)
      .where(eq(channelContent.channelId, CHANNEL_A_ID));
    expect(rows).toHaveLength(0);
  });

  // ── Guarantee 3: Own-content assign succeeds ───────────────────────────────

  it("G3: assigning creator A's own content to channel A succeeds and the row appears in the pool", async () => {
    const { createPlayoutOrchestrator } = await import(
      "../../../src/services/playout-orchestrator.js"
    );
    const { createStubLiquidsoapClient } = await import(
      "../../../src/services/liquidsoap-client.js"
    );
    const { db } = await import("../../../src/db/connection.js");
    const { channelContent } = await import(
      "../../../src/db/schema/playout-queue.schema.js"
    );
    const { eq } = await import("drizzle-orm");
    const orch = createPlayoutOrchestrator(createStubLiquidsoapClient());

    const result = await orch.assignContent(
      CHANNEL_A_ID,
      [],
      [CONTENT_A1_ID],
    );

    expect(result.ok).toBe(true);

    const rows = await db
      .select()
      .from(channelContent)
      .where(eq(channelContent.channelId, CHANNEL_A_ID));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.contentId).toBe(CONTENT_A1_ID);
  });

  // ── Guarantee 4: Queue-insert pool chokepoint ──────────────────────────────

  it("G4: inserting a playoutItemId NOT in the creator channel's pool is rejected", async () => {
    const { createPlayoutOrchestrator } = await import(
      "../../../src/services/playout-orchestrator.js"
    );
    const { createStubLiquidsoapClient } = await import(
      "../../../src/services/liquidsoap-client.js"
    );
    const { db } = await import("../../../src/db/connection.js");
    const { playoutQueue } = await import(
      "../../../src/db/schema/playout-queue.schema.js"
    );
    const { eq } = await import("drizzle-orm");
    const orch = createPlayoutOrchestrator(createStubLiquidsoapClient());

    // Attempt to queue a platform playout item that has not been added to the pool
    const result = await orch.insertIntoQueue(CHANNEL_A_ID, {
      playoutItemId: PLAYOUT_ITEM_ID,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.statusCode).toBe(403);

    // Nothing inserted into the queue
    const queueRows = await db
      .select()
      .from(playoutQueue)
      .where(eq(playoutQueue.channelId, CHANNEL_A_ID));
    expect(queueRows).toHaveLength(0);
  });

  // ── Guarantee 5: Cross-creator permission denied ───────────────────────────

  it("G5: userA (member of creatorA only) is denied permission on creatorB's channel", async () => {
    const { requireCreatorPermission } = await import(
      "../../../src/services/creator-team.js"
    );

    // userA trying to act on creatorB — must throw ForbiddenError
    await expect(
      requireCreatorPermission(USER_A_ID, CREATOR_B_ID, "manageStreaming"),
    ).rejects.toThrow("Insufficient permissions");
  });

  it("G5b: userA IS permitted on creatorA's channel (sanity check)", async () => {
    const { requireCreatorPermission } = await import(
      "../../../src/services/creator-team.js"
    );

    // Must not throw — userA is owner of creatorA
    await expect(
      requireCreatorPermission(USER_A_ID, CREATOR_A_ID, "manageStreaming"),
    ).resolves.toBeUndefined();
  });

  // ── Guarantee 6: Fail-closed on bogus channelId ────────────────────────────

  it("G6: a bogus/nonexistent channelId resolves to NotFoundError, never admin scope", async () => {
    const { createPlayoutOrchestrator } = await import(
      "../../../src/services/playout-orchestrator.js"
    );
    const { createStubLiquidsoapClient } = await import(
      "../../../src/services/liquidsoap-client.js"
    );
    const orch = createPlayoutOrchestrator(createStubLiquidsoapClient());

    const bogusId = `${PREFIX}-bogus-${randomUUID()}`;

    // Search on a nonexistent channel must fail closed
    const searchResult = await orch.searchAvailableContent(bogusId, "");
    expect(searchResult.ok).toBe(false);
    if (!searchResult.ok) {
      expect(searchResult.error.statusCode).toBe(404);
    }

    // Assign on a nonexistent channel must fail closed
    const assignResult = await orch.assignContent(bogusId, [], [CONTENT_A1_ID]);
    expect(assignResult.ok).toBe(false);
    if (!assignResult.ok) {
      expect(assignResult.error.statusCode).toBe(404);
    }

    // Queue-insert on a nonexistent channel must fail closed
    const queueResult = await orch.insertIntoQueue(bogusId, {
      playoutItemId: PLAYOUT_ITEM_ID,
    });
    expect(queueResult.ok).toBe(false);
    if (!queueResult.ok) {
      expect(queueResult.error.statusCode).toBe(404);
    }
  });

  // ── Guarantee 7: Soft-deleted content excluded ─────────────────────────────

  it("G7a: soft-deleted own content is not surfaced by search", async () => {
    const { createPlayoutOrchestrator } = await import(
      "../../../src/services/playout-orchestrator.js"
    );
    const { createStubLiquidsoapClient } = await import(
      "../../../src/services/liquidsoap-client.js"
    );
    const orch = createPlayoutOrchestrator(createStubLiquidsoapClient());

    const result = await orch.searchAvailableContent(CHANNEL_A_ID, "");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.value.map((r) => r.id);
    // The deleted content row must not appear
    expect(ids).not.toContain(CONTENT_A_DELETED_ID);
    // But active ones should still be present
    expect(ids).toContain(CONTENT_A1_ID);
  });

  it("G7b: soft-deleted own content cannot be assigned to the channel", async () => {
    const { createPlayoutOrchestrator } = await import(
      "../../../src/services/playout-orchestrator.js"
    );
    const { createStubLiquidsoapClient } = await import(
      "../../../src/services/liquidsoap-client.js"
    );
    const { db } = await import("../../../src/db/connection.js");
    const { channelContent } = await import(
      "../../../src/db/schema/playout-queue.schema.js"
    );
    const { eq } = await import("drizzle-orm");
    const orch = createPlayoutOrchestrator(createStubLiquidsoapClient());

    const result = await orch.assignContent(
      CHANNEL_A_ID,
      [],
      [CONTENT_A_DELETED_ID],
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.statusCode).toBe(403);

    // Nothing should be in the pool
    const rows = await db
      .select()
      .from(channelContent)
      .where(eq(channelContent.channelId, CHANNEL_A_ID));
    expect(rows).toHaveLength(0);
  });

  // ── Guarantee 8: listContent is creator-scoped (read-side guard) ────────────

  it("G8: listContent excludes foreign/platform/deleted rows even when they pollute channel_content directly", async () => {
    // The write path (assignContent) is creator-scoped, but the read must not rely
    // on that invariant. We insert polluted rows DIRECTLY into channel_content —
    // bypassing assignContent — to simulate a stale, migrated, or buggy write, then
    // assert listContent does not surface them. This is the read-side tenant guard.
    const { createPlayoutOrchestrator } = await import(
      "../../../src/services/playout-orchestrator.js"
    );
    const { createStubLiquidsoapClient } = await import(
      "../../../src/services/liquidsoap-client.js"
    );
    const { db } = await import("../../../src/db/connection.js");
    const { channelContent } = await import(
      "../../../src/db/schema/playout-queue.schema.js"
    );
    const { randomUUID } = await import("node:crypto");

    // Pollute channel A's pool directly: B's content, a platform playout item, and
    // A's own soft-deleted content — none of which a scoped write would ever allow.
    await db.insert(channelContent).values([
      {
        id: randomUUID(),
        channelId: CHANNEL_A_ID,
        contentId: CONTENT_B1_ID, // foreign creator's content
        playoutItemId: null,
      },
      {
        id: randomUUID(),
        channelId: CHANNEL_A_ID,
        contentId: null,
        playoutItemId: PLAYOUT_ITEM_ID, // platform playout item
      },
      {
        id: randomUUID(),
        channelId: CHANNEL_A_ID,
        contentId: CONTENT_A_DELETED_ID, // own, but soft-deleted
        playoutItemId: null,
      },
      {
        id: randomUUID(),
        channelId: CHANNEL_A_ID,
        contentId: CONTENT_A1_ID, // own, active — the ONLY row that should list
        playoutItemId: null,
      },
    ]);

    const orch = createPlayoutOrchestrator(createStubLiquidsoapClient());
    const result = await orch.listContent(CHANNEL_A_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const listedContentIds = result.value.map((r) => r.contentId);
    const listedPlayoutIds = result.value.map((r) => r.playoutItemId);

    // Only creator A's own active content surfaces
    expect(listedContentIds).toContain(CONTENT_A1_ID);
    // Foreign creator's content must NOT be listed
    expect(listedContentIds).not.toContain(CONTENT_B1_ID);
    // Soft-deleted own content must NOT be listed
    expect(listedContentIds).not.toContain(CONTENT_A_DELETED_ID);
    // Platform playout item must NOT be listed (creator pools are content-only)
    expect(listedPlayoutIds).not.toContain(PLAYOUT_ITEM_ID);
    // Exactly one row total (the active own-content row)
    expect(result.value).toHaveLength(1);
  });

  // ── Bonus: platform playout item assign rejected on creator channel ─────────

  it("creator channel: assigning a platform playoutItemId is rejected (creator pools are content-only)", async () => {
    const { createPlayoutOrchestrator } = await import(
      "../../../src/services/playout-orchestrator.js"
    );
    const { createStubLiquidsoapClient } = await import(
      "../../../src/services/liquidsoap-client.js"
    );
    const orch = createPlayoutOrchestrator(createStubLiquidsoapClient());

    const result = await orch.assignContent(
      CHANNEL_A_ID,
      [PLAYOUT_ITEM_ID], // platform item — forbidden for creator channels
      [],
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.statusCode).toBe(403);
  });

  // ── Function (not just isolation): creator's own content is playable ─────────
  //
  // The isolation tests above prove B's content stays OUT of A's pool. This proves
  // A's OWN content actually plays: a creator channel whose pool is all content rows
  // auto-fills PLAYABLE content_id queue rows (the FK-violation fix — a content.id no
  // longer gets jammed into the playout_item_id FK column), and getChannelQueueStatus
  // surfaces those content rows (the INNER-JOIN read bug fix). This is the AC#1/AC#2
  // function guarantee that the original review missed.

  it("creator own-content pool: auto-fill inserts playable content_id rows (no FK error) and queue-status lists them", async () => {
    const { createPlayoutOrchestrator } = await import(
      "../../../src/services/playout-orchestrator.js"
    );
    const { createStubLiquidsoapClient } = await import(
      "../../../src/services/liquidsoap-client.js"
    );
    const { db } = await import("../../../src/db/connection.js");
    const { playoutQueue, channelContent } = await import(
      "../../../src/db/schema/playout-queue.schema.js"
    );
    const { eq, and, isNotNull } = await import("drizzle-orm");
    const orch = createPlayoutOrchestrator(createStubLiquidsoapClient());

    // Pool channel A with the creator's OWN content (the creator-scoped assign path
    // accepts own content; A1 + A2 are A's active videos).
    const assigned = await orch.assignContent(
      CHANNEL_A_ID,
      [],
      [CONTENT_A1_ID, CONTENT_A2_ID],
    );
    expect(assigned.ok).toBe(true);

    // Sanity: the pool rows are content rows (content_id set, playout_item_id null).
    const poolRows = await db
      .select()
      .from(channelContent)
      .where(eq(channelContent.channelId, CHANNEL_A_ID));
    expect(poolRows).toHaveLength(2);
    expect(poolRows.every((r) => r.contentId !== null && r.playoutItemId === null)).toBe(
      true,
    );

    // Auto-fill MUST NOT throw an FK violation. Against the old alias
    // (content_id AS playout_item_id) this rejected at insert; the fix carries the
    // real source type so the id lands in content_id.
    await expect(orch.autoFill(CHANNEL_A_ID)).resolves.toBeUndefined();

    // The queue now holds content_id rows (playable), never a content.id in the
    // playout_item_id FK column.
    const queueRows = await db
      .select()
      .from(playoutQueue)
      .where(eq(playoutQueue.channelId, CHANNEL_A_ID));
    expect(queueRows.length).toBeGreaterThan(0);
    // Every auto-filled row is a content source.
    expect(queueRows.every((r) => r.contentId !== null)).toBe(true);
    expect(queueRows.every((r) => r.playoutItemId === null)).toBe(true);
    // The content ids are the creator's own pooled content.
    const queuedContentIds = queueRows.map((r) => r.contentId).sort();
    expect(queuedContentIds).toEqual([CONTENT_A1_ID, CONTENT_A2_ID].sort());

    // Belt-and-suspenders against the FK-jam regression: no queue row carries a
    // content.id in the playout_item_id column.
    const jammedRows = await db
      .select()
      .from(playoutQueue)
      .where(
        and(
          eq(playoutQueue.channelId, CHANNEL_A_ID),
          isNotNull(playoutQueue.playoutItemId),
        ),
      );
    expect(jammedRows).toHaveLength(0);

    // getChannelQueueStatus must LIST the content rows (the INNER-JOIN bug would drop
    // them) with their real title/duration coalesced from the content table.
    const status = await orch.getChannelQueueStatus(CHANNEL_A_ID);
    expect(status.ok).toBe(true);
    if (!status.ok) return;

    const entries = [
      ...(status.value.nowPlaying ? [status.value.nowPlaying] : []),
      ...status.value.upcoming,
    ];
    // Both content rows surface — none dropped by the join.
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.sourceType === "content")).toBe(true);
    expect(entries.every((e) => e.contentId !== null)).toBe(true);
    expect(entries.every((e) => e.playoutItemId === null)).toBe(true);
    // Title is coalesced from the content table (seeded titles), not null.
    const listedTitles = entries.map((e) => e.title).sort();
    expect(listedTitles).toEqual(
      ["Creator A Video 1", "Creator A Video 2"].sort(),
    );
  });

  // ── Guarantee 9: read-side scope on the auto-fill + playback paths ──────────
  //
  // The playback-path analogue of G8 (cross-model pass-2 finding B3). The write/manual
  // chokepoint (insertIntoQueue) is scoped, but auto-fill and resolvePoolNextUri read
  // channel_content directly. A directly-polluted row (foreign creator + soft-deleted),
  // bypassing the scoped assign, must NOT be auto-queued and must NOT be served as a
  // playback URI for a creator channel. We give the polluted rows a real mediaKey so
  // they WOULD resolve a URI if the scope filter were missing — the test has teeth.

  it("G9: auto-fill and resolvePoolNextUri exclude foreign/deleted rows that pollute channel_content directly", async () => {
    const { createPlayoutOrchestrator } = await import(
      "../../../src/services/playout-orchestrator.js"
    );
    const { createStubLiquidsoapClient } = await import(
      "../../../src/services/liquidsoap-client.js"
    );
    const { resolvePoolNextUri } = await import(
      "../../../src/services/editorial-control.js"
    );
    const { db } = await import("../../../src/db/connection.js");
    const { content } = await import("../../../src/db/schema/content.schema.js");
    const { playoutQueue, channelContent } = await import(
      "../../../src/db/schema/playout-queue.schema.js"
    );
    const { eq } = await import("drizzle-orm");
    const { randomUUID } = await import("node:crypto");

    // Give the polluted content rows a real mediaKey so resolvePoolNextUri WOULD
    // return their URI if the scope filter were absent (otherwise the test passes
    // for the wrong reason). A1 (own, active) also gets a key so it's playable.
    await db.update(content).set({ mediaKey: "media/a1.mp4" }).where(eq(content.id, CONTENT_A1_ID));
    await db.update(content).set({ mediaKey: "media/b1.mp4" }).where(eq(content.id, CONTENT_B1_ID));
    await db.update(content).set({ mediaKey: "media/a-del.mp4" }).where(eq(content.id, CONTENT_A_DELETED_ID));

    // Pollute channel A's pool DIRECTLY (bypassing the scoped assignContent) with a
    // foreign creator's content and A's own soft-deleted content, plus A's own active
    // content (the only row that should ever be auto-queued or served).
    await db.insert(channelContent).values([
      { id: randomUUID(), channelId: CHANNEL_A_ID, contentId: CONTENT_B1_ID, playoutItemId: null },        // foreign
      { id: randomUUID(), channelId: CHANNEL_A_ID, contentId: CONTENT_A_DELETED_ID, playoutItemId: null }, // soft-deleted
      { id: randomUUID(), channelId: CHANNEL_A_ID, contentId: CONTENT_A1_ID, playoutItemId: null },        // own, active
    ]);

    // ── auto-fill must NOT queue the foreign or deleted rows ──
    const orch = createPlayoutOrchestrator(createStubLiquidsoapClient());
    await expect(orch.autoFill(CHANNEL_A_ID)).resolves.toBeUndefined();

    const queuedContentIds = (
      await db.select().from(playoutQueue).where(eq(playoutQueue.channelId, CHANNEL_A_ID))
    ).map((r) => r.contentId);

    expect(queuedContentIds).not.toContain(CONTENT_B1_ID);        // foreign creator — never auto-queued
    expect(queuedContentIds).not.toContain(CONTENT_A_DELETED_ID); // soft-deleted — never auto-queued
    expect(queuedContentIds).toContain(CONTENT_A1_ID);            // own active — IS queued (function preserved)

    // ── resolvePoolNextUri must NOT serve the foreign or deleted rows ──
    // Seeded creator-A scope (what the pool-next callback resolves for a creator channel).
    const seenUris: string[] = [];
    for (let i = 0; i < 5; i++) {
      const uri = await resolvePoolNextUri(CHANNEL_A_ID, { creatorId: CREATOR_A_ID });
      if (uri) seenUris.push(uri);
    }
    // The foreign + deleted media keys must NEVER be returned for playback.
    expect(seenUris.some((u) => u.includes("media/b1.mp4"))).toBe(false);
    expect(seenUris.some((u) => u.includes("media/a-del.mp4"))).toBe(false);
    // Only A's own active media is served.
    expect(seenUris.every((u) => u.includes("media/a1.mp4"))).toBe(true);
  });
});
