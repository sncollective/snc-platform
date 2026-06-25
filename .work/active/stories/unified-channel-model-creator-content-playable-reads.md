---
id: unified-channel-model-creator-content-playable-reads
kind: story
stage: review
tags: [streaming, playout]
parent: unified-channel-model-creator-content-playable
depends_on: [unified-channel-model-creator-content-playable-schema]
release_binding: null
gate_origin: null
created: 2026-06-24
updated: 2026-06-25
---

# Fix queue-status reads, auto-fill, and the insert chokepoint for content sources

Unit 3 of `unified-channel-model-creator-content-playable`. Depends on the schema widening; runs
parallel with the transitions story (Unit 2).

## Scope
**File**: `apps/api/src/services/playout-orchestrator.ts`.

- **Queue-status reads** (`getChannelQueueStatus`, the two reads at ~lines 192, 248): they
  `.innerJoin(playoutItems, eq(playoutQueue.playoutItemId, playoutItems.id))`, which DROPS any
  queue row whose `playoutItemId` is null (every content row). Convert to LEFT joins against both
  `playout_items` and `content`, coalescing `title` / `duration` / `sourceType` — same shape as the
  G8 `listContent` UNION. `toQueueEntry` learns `contentId` + `sourceType`.
- **Auto-fill candidate query** (~line 776): STOP aliasing `cc.content_id AS playout_item_id`. Carry
  the real source type and feed `enqueueBatch` typed `QueueSource[]` (Unit 2). **This is the
  FK-violation fix** — the current alias jams a `content.id` into the `playout_item_id` FK column.
- **`insertIntoQueue` creator chokepoint** (~line 401): already requires the item be in the
  channel's scoped pool — generalize the membership check to match on the correct column (content vs
  playout) so content items can be queued while the pool-scoping guarantee holds.

## Acceptance
- [x] A creator channel whose pool is all creator content auto-fills PLAYABLE rows — no FK error, no unplayable rows.
- [x] Queue status lists content rows with correct title/duration/sourceType.
- [x] The pool chokepoint still rejects items not in the channel's scoped pool (cross-tenant G4 stays green).
- [x] Cross-tenant guarantees G1–G8 stay green (content scoping survives the read changes).

## Implementation notes

Implemented inline (no sub-agents). All four designed areas landed, plus the
nullability ripples the schema widening forced.

### Dependency reconciliation
`depends_on` schema story is at `stage: review` (not `done`), but its code is
committed and physically present in the tree (verified the nullable
`playoutItemId`, the `content_id` FK, and the `playout_queue_one_source` CHECK in
`playout-queue.schema.ts`, and the `QueueSource` contract in
`playout-queue-transitions.ts`). `review` is the reviewer's approval gate, not a
code-availability gate — implementing against landed-but-unapproved sibling code
is the parallel-after-schema plan the parent feature lays out, not implementing
ahead of unwritten code.

### The new `insertIntoQueue` signature (for the UI story to call)
```ts
insertIntoQueue(
  channelId: string,
  source: { playoutItemId: string } | { contentId: string },  // QueueSource
  position?: number,
): Promise<Result<PlayoutQueueEntry, AppError>>
```
The second positional arg changed from a bare `playoutItemId: string` to the
discriminated `QueueSource` (same type the transitions layer exports). Story 4's
creator/admin queue-insert routes pass `{ playoutItemId }` (admin/library) or
`{ contentId }` (creator content). A source-aware shared validator
`InsertQueueSourceSchema` (+ `InsertQueueSource` type) was added in
`packages/shared/src/playout-queue.ts` for story 4 to wire — exactly-one-of refine,
additive (the playout-only `InsertQueueItemSchema` is untouched).

### Area 1 — queue-status reads (the INNER-JOIN drop bug)
Both reads (`getChannelQueueStatus`, `getMultiChannelQueueStatus`) converted from
`.innerJoin(playoutItems)` to `.leftJoin(playoutItems).leftJoin(content)`. A shared
module-level `QUEUE_STATUS_COLUMNS` projection coalesces `title`/`duration` from
whichever side is set and derives `sourceType` via a `CASE` on which FK is
populated (single source of truth — the two reads can't drift). A content queue row
now surfaces with its content title/duration instead of being silently dropped.

### Area 2 — `toQueueEntry`
Now carries `contentId` + `sourceType` onto `PlayoutQueueEntry`. The shared
`PlayoutQueueEntrySchema` was widened (additive/backward-compatible): `playoutItemId`
is now nullable, `contentId` (nullable) and `sourceType` ('playout'|'content') added.
Existing playout rows keep their `playoutItemId` and gain `contentId: null`,
`sourceType: "playout"`.

### Area 3 — `insertIntoQueue` chokepoint (the security surface)
Generalized to a discriminated source WITHOUT weakening cross-tenant scoping:
- The creator pool-membership check keys on the SAME column the source sets —
  `content_id` for a content source, `playout_item_id` for a playout source. Keying
  the wrong column would let an unpooled source slip through; this is the load-bearing
  correctness point. A source outside the channel's scoped pool is rejected
  `ForbiddenError` (no existence leak), exactly as before.
- Existence validation dispatches to `playout_items` vs `content` per the source.
- Admin/platform path unchanged (no pool gate; full-library queueing).
- Still fails closed on a missing channel (NotFoundError, never admin scope).

### Area 4 — auto-fill (the FK-violation bug)
Stopped aliasing `cc.content_id AS playout_item_id`. Each UNION arm now carries
`source_type` + `source_id`, mapped to a typed `QueueSource[]` for `enqueueBatch` so
a content id lands in `content_id` and a playout id in `playout_item_id` (one-source
CHECK holds, no FK violation). Also added a per-column exclusion subquery to the
content arm (the old alias made content-row dedup impossible to express) so content
rows aren't re-queued every auto-fill.

### Ripples the widening forced (kept content rows playable end-to-end)
- `pushPrefetchBuffer`: now selects + passes `contentId` to `resolveContentUri` (it
  already resolved content URIs; the caller was dropping the id, so content rows
  would never push to Liquidsoap).
- `onTrackStarted`: the `channel_content` play-stats update keys on the populated
  source column (matching `playout_item_id = NULL` updates nothing for content rows).
- `playout.ts` `getPlayoutStatus`: the admin-status `itemId` now picks the populated
  source id via `sourceType` (a content row's `playoutItemId` is null) — keeps the
  non-null queued `itemId` correct; skips defensively rather than emit an empty id.

### Deviations from design
None substantive. The design named the 4 areas; the `pushPrefetchBuffer` /
`onTrackStarted` / `playout.ts` ripples were not enumerated but are required for the
nullable-`playoutItemId` schema to function (content rows must actually push + track
stats). All within this story's file scope intent (make content sources playable).

### Verification
- `bun run --filter @snc/api typecheck` → CLEAN (zero errors). The last backend story
  pass/fail gate is green.
- `bun run --filter @snc/api test:unit` → 1861 passed (115 files). Added unit coverage:
  `getChannelQueueStatus` read-coalescing (playout + content rows surface with
  sourceType + coalesced title/duration), content-source `insertIntoQueue` (own pooled
  content queues + content_id matched; unpooled content rejected ForbiddenError),
  auto-fill mapping playout→playoutItemId / content→contentId (FK-fix). Repaired
  drifted mocks/fixtures (old `insertIntoQueue(ch, string)` call shape; old
  `{ playout_item_id }` candidate row shape; queue-status fixtures lacking
  contentId/sourceType).
- **Cross-tenant integration (mandatory)** —
  `test:integration -- tests/integration/creator-playout/cross-tenant-isolation.test.ts`:
  **12 passed** = all 11 original (G1–G8 + the 3 bonus/sub variants) STILL GREEN, plus
  the new mandated test "creator own-content pool: auto-fill inserts playable
  content_id rows (no FK error) and queue-status lists them" — proves function, not
  just isolation. G4 log confirms the generalized chokepoint still rejects the unpooled
  playout item.
- `test:integration -- tests/integration/jobs/playout-queue-cleanup.test.ts` → 6 passed
  (queue cleanup unaffected).
- Cross-surface: `@snc/shared` typecheck + 675 tests, `@snc/web` typecheck +
  1798 tests all green (web queue-entry fixtures updated for the widened shape; no web
  production code change — story 4 owns the UI).

### Follow-up risk
None blocking. Story 4 (UI) wires the routes to pass `{ contentId }` for content rows
and drops the picker's playout-only filter; `InsertQueueSourceSchema` is ready for it.
