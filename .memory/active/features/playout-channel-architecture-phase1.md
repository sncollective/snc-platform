---
id: feature-playout-channel-architecture-phase1
kind: feature
stage: done
tags: [streaming]
release_binding: 0.2.1
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: playout-channel-architecture
---

# Playout Channel Architecture — Phase 1 (Backend Foundation)

> **Review outcome (2026-04-18):** skip-with-note. Phase 1's code-level acceptance is verified — new tables (`channel_content`, `playout_queue`) are migrated, `createPlayoutOrchestrator` returns the designed methods (`onTrackStarted`, `insertIntoQueue`, `removeFromQueue`, `skip`, `assignContent`, `removeContent`, `listContent`, `autoFill`, `initialize`), the auto-fill query uses the least-recently-played + random strategy, the track-event webhook route responds, and the admin CRUD routes are wired through. User-visible end-to-end testing (watch queue advance correctly as content plays on the stream) was **blocked by a downstream issue**: the API's `srsCallbackLimiter` on `/api/streaming/callbacks/*` interacts with a Liquidsoap RTMP retry loop to produce a queue-thrash cycle that prevents any content from actually broadcasting. That issue is neither a Phase 1 design gap nor a Phase 1 implementation bug — the orchestrator is behaving as designed; the visible brokenness sits in the rate-limiter ↔ Liquidsoap retry interaction. Parked as the active story `streaming-callback-rate-limit`. The earlier status note claimed Phase 1 was blocked by Phase 2; that was stale — Phase 2 is now also `done` and its real `LiquidsoapClient` is wired up. Bound to 0.2.1.

## Overview

Phase 1 of the playout channel architecture rethink. Builds the data model, queue orchestration service, content pool CRUD, and track-event webhook endpoint. Liquidsoap integration and admin UI are Phase 2 and Phase 3 respectively.

### What Phase 1 delivers:
- New `channel_content` and `playout_queue` tables
- Queue orchestrator service with auto-fill logic (recency + random)
- Content pool management (assign/remove items to/from channels)
- Track-event webhook endpoint (called by Liquidsoap in Phase 2)
- Shared types for the new model
- Stubbed Liquidsoap client interface (Phase 2 fills in)

### What Phase 1 does NOT change:
- Liquidsoap config (`playout.liq`) — unchanged until Phase 2
- Admin UI — unchanged until Phase 3
- Existing playout routes/service — coexists; old system keeps working

## Implementation Units

### Unit 1: Shared Types

**File**: `platform/packages/shared/src/playout-queue.ts`

New shared types for the queue system:
- `QUEUE_STATUSES = ["queued", "playing", "played"]`
- `ChannelContentSchema` — pool item with id, channelId, playoutItemId, lastPlayedAt, playCount, createdAt
- `PlayoutQueueEntrySchema` — queue entry with position, status, pushedToLiquidsoap, denormalized title/duration
- `ChannelQueueStatusSchema` — admin view: nowPlaying, upcoming, poolSize
- `AssignContentSchema`, `RemoveContentSchema`
- `TrackEventSchema` — webhook payload from Liquidsoap
- `InsertQueueItemSchema`

Re-export from `platform/packages/shared/src/index.ts`.

**Acceptance Criteria**:

- [ ] All types/schemas exported from `@snc/shared`
- [ ] `bun --cwd=./platform run --filter @snc/shared build` passes

---

### Unit 2: Database Schema — `channel_content` Table

**File**: `platform/apps/api/src/db/schema/playout-queue.schema.ts`

```typescript
export const channelContent = pgTable(
  "channel_content",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
    playoutItemId: text("playout_item_id").notNull().references(() => playoutItems.id, { onDelete: "cascade" }),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true }),
    playCount: integer("play_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("channel_content_channel_item_idx").on(table.channelId, table.playoutItemId),
    index("channel_content_channel_idx").on(table.channelId),
    index("channel_content_last_played_idx").on(table.channelId, table.lastPlayedAt),
  ],
);
```

**Acceptance Criteria**:

- [ ] Migration generated via `bun --cwd=./platform run --filter @snc/api db:generate`
- [ ] Migration applied via `bun --cwd=./platform run --filter @snc/api db:migrate`
- [ ] Unique constraint prevents duplicate channel+item combinations

---

### Unit 3: Database Schema — `playout_queue` Table

Same file as Unit 2. Indexes on `(channelId, position)` and `(channelId, status)`.

**Acceptance Criteria**:

- [ ] Both tables created in a single migration
- [ ] Indexes support the orchestrator's query patterns

---

### Unit 4: Liquidsoap Client Interface (Stub)

**File**: `platform/apps/api/src/services/liquidsoap-client.ts`

```typescript
export type LiquidsoapClient = {
  pushTrack(channelId: string, uri: string): Promise<Result<void, AppError>>;
  skipTrack(channelId: string): Promise<Result<void, AppError>>;
};

export const createStubLiquidsoapClient = (): LiquidsoapClient => ({
  async pushTrack(channelId, uri) {
    logger.info({ channelId, uri }, "STUB: pushTrack");
    return ok(undefined);
  },
  async skipTrack(channelId) {
    logger.info({ channelId }, "STUB: skipTrack");
    return ok(undefined);
  },
});
```

---

### Unit 5: Queue Orchestrator Service

**File**: `platform/apps/api/src/services/playout-orchestrator.ts`

`createPlayoutOrchestrator(client: LiquidsoapClient)` returns:
- `getChannelQueueStatus(channelId)`
- `onTrackStarted(channelId, uri)` — mark played, promote next, auto-fill, push prefetch
- `insertIntoQueue(channelId, playoutItemId, position?)` — with position shifting
- `removeFromQueue(channelId, queueEntryId)`
- `skip(channelId)` — mark played, call client.skipTrack, advance
- `assignContent(channelId, playoutItemIds[])`
- `removeContent(channelId, playoutItemIds[])`
- `listContent(channelId)`
- `autoFill(channelId)` — weighted random, least-recently-played first
- `initialize()` — fill + push for all active playout channels

**Auto-fill query strategy:**
```sql
SELECT cc.playout_item_id, cc.last_played_at, cc.play_count
FROM channel_content cc
JOIN playout_items pi ON pi.id = cc.playout_item_id
WHERE cc.channel_id = $channelId
  AND pi.processing_status = 'ready'
  AND cc.playout_item_id NOT IN (
    SELECT playout_item_id FROM playout_queue
    WHERE channel_id = $channelId AND status IN ('queued', 'playing')
  )
ORDER BY
  cc.last_played_at ASC NULLS FIRST,
  cc.play_count ASC,
  random()
LIMIT $batchSize
```

Constants: `PREFETCH_DEPTH = 3`, `AUTO_FILL_THRESHOLD = 5`, `AUTO_FILL_BATCH = 10`.

**Acceptance Criteria**:

- [ ] `createPlayoutOrchestrator(client)` returns an orchestrator with all methods
- [ ] `autoFill` selects from content pool, excludes items already in queue, prefers least-recently-played
- [ ] `onTrackStarted` advances queue and triggers auto-fill
- [ ] `insertIntoQueue` handles position shifting
- [ ] `skip` marks current as played and advances

---

### Unit 6: Track Event Webhook + Admin Routes

**File**: `platform/apps/api/src/routes/playout-channels.routes.ts`

Routes:
- `POST /channels/:channelId/track-event` — authenticated via `PLAYOUT_CALLBACK_SECRET` query param (same pattern as SRS callbacks)
- `GET /channels/:channelId/queue` — admin: queue status
- `POST /channels/:channelId/queue/items` — admin: insert into queue
- `DELETE /channels/:channelId/queue/items/:entryId` — admin: remove from queue
- `POST /channels/:channelId/skip` — admin: skip current track
- `GET /channels/:channelId/content` — admin: list pool
- `POST /channels/:channelId/content` — admin: assign items
- `DELETE /channels/:channelId/content` — admin: remove items

---

### Unit 7: Orchestrator Singleton and Route Registration

**File**: `platform/apps/api/src/routes/playout-channels.init.ts`

Singleton with stub client for Phase 1.

**File**: `platform/apps/api/src/config.ts` — add `PLAYOUT_CALLBACK_SECRET: z.string().min(32).optional()`

---

### Unit 8: Orchestrator Startup Hook

**File**: `platform/apps/api/src/jobs/register-workers.ts`

`await orchestrator.initialize()` after existing worker registration.

---

### Unit 9: Extract `selectPlayoutRenditionUri` to Shared Helper

**File**: `platform/apps/api/src/services/playout-utils.ts`

Extract rendition selection logic from `playout.ts` so both old service and new orchestrator can use it.

---

## Implementation Order

1. **Unit 1**: Shared types
2. **Unit 2 + 3**: Database schema (both tables in same file) — run `db:generate` + `db:migrate` after
3. **Unit 9**: Extract rendition helper
4. **Unit 4**: Liquidsoap client stub
5. **Unit 5**: Queue orchestrator service
6. **Unit 6 + 7**: Routes + registration + config
7. **Unit 8**: Startup hook

## Integration Notes

The orchestrator tests should use a real test database (Drizzle + test Postgres) for the query-heavy auto-fill logic. Mock the `LiquidsoapClient` only. This catches SQL query issues that unit mocks would hide.

## Verification Checklist

```bash
bun --cwd=./platform run --filter @snc/shared build
bun --cwd=./platform run --filter @snc/api db:generate
bun --cwd=./platform run --filter @snc/api db:migrate
bun --cwd=./platform run --filter @snc/api test
pm2 restart all
pm2 logs api --lines 20
# Look for "Playout orchestrator initialized"
```
