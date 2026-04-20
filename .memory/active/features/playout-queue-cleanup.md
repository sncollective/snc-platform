---
id: feature-playout-queue-cleanup
kind: feature
stage: review
tags: [streaming, media-pipeline]
release_binding: null
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Playout Queue Cleanup

Daily cron job that enforces a per-channel cap of 100 `played` rows in `playout_queue`. Handler at `jobs/handlers/playout-queue-cleanup.ts`, registered in `register-workers.ts`, integration test at `tests/integration/jobs/playout-queue-cleanup.test.ts` (6 scenarios, all passing).

## Tasks

- [ ] Cleanup played items from playout_queue — daily setInterval cron enforces a per-channel cap of 100 `played` rows (scale-invariant).

---

## Design

### Overview

The `playout_queue` table is append-only. Items start as `queued`, transition to `playing`, then `played`. The UI query filters to `queued` + `playing` — `played` rows are never shown but also never deleted. Over time this grows unbounded.

Row counts are heavily dependent on track length: 15-second tracks yield ~5,760 plays/channel/day, 5-minute tracks yield ~288/day. A time-based retention window produces wildly different results depending on the content. A **per-channel row cap** is scale-invariant — keep the last N `played` rows per channel for debugging, drop the rest.

This design adds a daily cleanup job that enforces a per-channel cap on `played` row history. Matches the existing setInterval pattern used by the event reminder cron (`jobs/handlers/event-reminder.ts` + `jobs/register-workers.ts`).

---

### Decisions

- **Retention policy:** Keep the **100 most recent `played` rows per channel**. Anything older gets deleted. Scale-invariant — works identically for 15-second test clips and 5-minute real tracks.
- **Cleanup frequency:** Once every hour. Short tracks (15-sec clips) produce ~240 plays/channel/hour, so hourly keeps the peak table size close to the cap. A 24-hour interval would let ~5,100 rows/channel accrue between runs — fine for storage but diverges from what the "cap of 100" implies. Hourly holds it at ~340 peak.
- **"Most recent" ordering:** By `position` DESC. Position is monotonic within a channel (orchestrator inserts at `max(position) + 1` for end-of-queue appends), so it's a reliable ordering that doesn't require a separate timestamp.
- **SQL approach:** Per-channel `DELETE ... WHERE id NOT IN (SELECT id FROM ... ORDER BY position DESC LIMIT 100)`. One statement per channel inside a transaction. Simpler than a single window-function query and easier to test.
- **Scheduling mechanism:** Node `setInterval`, matching `register-workers.ts` line 109. Not pg-boss cron — no precedent in this codebase, and the job is internal, idempotent, and non-critical.
- **No startup run:** Matches event-reminder pattern. If the process restarts within 24 hours, the next run waits for the full interval. Acceptable because the cap is soft.
- **No configuration knobs:** `HISTORY_CAP_PER_CHANNEL` constant inline in the handler. Easy to change later.

### Out of scope

- Configurable cap via `.env` var
- Cleanup of other job/history tables (pg-boss has its own `maintenanceIntervalSeconds`)
- Moving `played` rows to an archive table
- Cleanup of orphaned `queued`/`playing` rows (different failure mode, different fix)

---

### Unit 1: Cleanup handler

**File:** `apps/api/src/jobs/handlers/playout-queue-cleanup.ts`

```typescript
import { and, eq, notInArray, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { playoutQueue } from "../../db/schema/playout-queue.schema.js";
import { channels } from "../../db/schema/streaming.schema.js";
import { rootLogger } from "../../logging/logger.js";

// ── Constants ──

/** Maximum number of `played` rows to retain per channel. Older rows are deleted. */
const HISTORY_CAP_PER_CHANNEL = 100;

// ── Public API ──

/**
 * Enforce the per-channel cap on `played` row history in playout_queue.
 *
 * For each playout channel, keeps the most recent `HISTORY_CAP_PER_CHANNEL` played
 * rows (by position DESC) and deletes the rest. Idempotent — safe to call repeatedly.
 * Returns the total number of rows deleted across all channels.
 *
 * Intended to run as a periodic job (every 24 hours).
 */
export const handlePlayoutQueueCleanup = async (): Promise<number> => {
  const channelRows = await db
    .selectDistinct({ channelId: playoutQueue.channelId })
    .from(playoutQueue)
    .where(eq(playoutQueue.status, "played"));

  let totalDeleted = 0;

  for (const { channelId } of channelRows) {
    const keepIds = db
      .select({ id: playoutQueue.id })
      .from(playoutQueue)
      .where(
        and(
          eq(playoutQueue.channelId, channelId),
          eq(playoutQueue.status, "played"),
        ),
      )
      .orderBy(sql`${playoutQueue.position} DESC`)
      .limit(HISTORY_CAP_PER_CHANNEL);

    const deleted = await db
      .delete(playoutQueue)
      .where(
        and(
          eq(playoutQueue.channelId, channelId),
          eq(playoutQueue.status, "played"),
          notInArray(playoutQueue.id, keepIds),
        ),
      )
      .returning({ id: playoutQueue.id });

    totalDeleted += deleted.length;
  }

  if (totalDeleted > 0) {
    rootLogger.info(
      {
        totalDeleted,
        channelCount: channelRows.length,
        capPerChannel: HISTORY_CAP_PER_CHANNEL,
      },
      "Playout queue cleanup completed",
    );
  }

  return totalDeleted;
};
```

**Implementation notes:**

- **Why per-channel loop instead of a single window-function query.** A single-statement DELETE with `ROW_NUMBER() OVER (PARTITION BY channel_id ORDER BY position DESC)` is more elegant but requires raw SQL (Drizzle's query builder doesn't compose window functions over DELETE subqueries cleanly). The per-channel loop is ordinary Drizzle, easy to test with the chainable mock pattern, and the channel count is tiny (2-10 at realistic platform scale). The overhead is a few extra round trips per day — negligible.
- **`notInArray` with a subquery.** Drizzle passes the subquery through as `NOT IN (SELECT ...)`. Postgres handles this efficiently with the `(channel_id, status)` index.
- **Ordering by `position` DESC.** Position is monotonic per channel (orchestrator inserts at `max(position) + 1`). Most recent plays have the highest positions. No `playedAt` column exists, and `created_at` would be equivalent ordering but less semantically obvious.
- **Only iterates channels that have `played` rows.** Idle channels with no history incur zero work.
- **No transaction wrapping.** Each per-channel DELETE is an independent operation. Partial progress on failure is fine — the next run picks up where we left off.
- **No Result wrapping.** Matches `handleEventReminderDispatch` — caller uses `.catch()` on the promise; the handler throws on DB error.

**Acceptance criteria:**

- [ ] Function deletes `played` rows beyond the 100 most recent per channel (by position DESC)
- [ ] Returns total number of deleted rows across all channels
- [ ] Does not touch rows with `status` of `queued` or `playing`
- [ ] Does not touch the 100 most recent `played` rows on any channel
- [ ] Does nothing on channels with ≤ 100 `played` rows
- [ ] Does nothing when no `played` rows exist anywhere
- [ ] Logs a single info entry when rows were deleted (count, channel count, cap)
- [ ] Does NOT log on empty runs
- [ ] Throws on DB error (caller handles)

---

### Unit 2: Register setInterval in register-workers

**File:** `apps/api/src/jobs/register-workers.ts` (modify)

Add an import and a second `setInterval` block mirroring the existing event reminder cron.

**Add to imports (after `handleEventReminderDispatch` import):**

```typescript
import { handlePlayoutQueueCleanup } from "./handlers/playout-queue-cleanup.js";
```

**Add after the event reminder cron block:**

```typescript
  // Playout queue cleanup cron — delete `played` rows older than retention every 24h
  const PLAYOUT_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    handlePlayoutQueueCleanup().catch((err) =>
      rootLogger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Playout queue cleanup failed",
      ),
    );
  }, PLAYOUT_CLEANUP_INTERVAL_MS);
  rootLogger.info("Playout queue cleanup cron registered (every 24 hours)");
```

**Implementation notes:**

- Placement: immediately after the event reminder cron registration, before the Liquidsoap config write. Visually groups the two cron registrations.
- `24 * 60 * 60 * 1000 = 86_400_000` ms — well within the 2^31-1 ms limit for Node setInterval.
- Error handler mirrors event reminder: log + swallow, don't crash the process.
- Error log shape matches pino conventions.

**Acceptance criteria:**

- [ ] `handlePlayoutQueueCleanup` imported from the new handler file
- [ ] `setInterval` registered with 24-hour interval
- [ ] Errors logged via `rootLogger.error`, not re-thrown
- [ ] Info log on registration: "Playout queue cleanup cron registered (every 24 hours)"
- [ ] API still starts successfully (`bun run --filter @snc/api test:integration` smoke test passes)

---

## Implementation order

1. Unit 1 — Create handler (`jobs/handlers/playout-queue-cleanup.ts`)
2. Unit 2 — Register in `register-workers.ts` (depends on Unit 1 via import)

## Testing

Integration test: `apps/api/tests/integration/jobs/playout-queue-cleanup.test.ts`

The row-cap logic has enough moving parts (distinct channels, subquery for keep-ids, per-channel deletes, ordering by position) that unit testing with the drizzle chainable mock becomes brittle. Use the integration test suite (`bun run --filter @snc/api test:integration`) which runs against a real `.env` + Postgres. Six scenarios: over-cap trim, correctness of "most recent" preservation, at-cap no-op, empty-DB no-op, multi-channel independence, and queued/playing safety.

```bash
bun run --filter @snc/api build
bun run --filter @snc/api test:unit
bun run --filter @snc/api test:integration
```
