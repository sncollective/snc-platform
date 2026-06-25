---
id: unified-channel-model-creator-content-playable-reads
kind: story
stage: done
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

## Review findings (2026-06-25, cross-model pass 2) — BOUNCED to implementing

Codex pass-2 (job 20260625T044622Z) found a **real cross-tenant blocker this story missed**, on the
READ/PLAYBACK paths (the write/manual chokepoint in `insertIntoQueue` was confirmed SAFE). Verified
against the code — accepting. This is the same defense-in-depth gap as B2/G8 (the read must not trust
that writes were perfectly scoped), but on auto-fill + playback instead of `listContent`:

- **B3a — `autoFill` candidate query is not creator-scoped** (`playout-orchestrator.ts` ~860). The
  content arm joins `content` and filters only on `cc.channel_id` + processing/type — NO
  `c.creator_id = scope.creatorId` and NO `c.deleted_at IS NULL`. A foreign/platform/soft-deleted
  row sitting in this channel's `channel_content` (the exact G8 pollution scenario) gets auto-queued.
  This story fixed the auto-fill FK bug (functional) but never added the tenant filter.
- **B3b — `resolvePoolNextUri` explicitly discards scope** (`editorial-control.ts:318-342`). It takes
  a `scope` param and `void scope;`s it (comment: "enforcement is at seed time" — the same calcified
  assumption B2 disproved), then selects ALL `channel_content` rows for the channel and resolves
  their URIs **for playback**. A polluted/foreign/deleted row would be served to viewers. This is the
  most serious of the three — it's the actual Liquidsoap pool-next playback path, not a list/queue.

**Fix (symmetric with B2/G8):** for creator scope, both `autoFill` and `resolvePoolNextUri` must
suppress the playout branch and constrain content to `creator_id = scope.creatorId AND
deleted_at IS NULL` (plus the existing playable constraints). `resolvePoolNextUri` already RECEIVES
the scope — wire it in instead of voiding it. Add integration coverage: a directly-polluted
`channel_content` row (foreign + deleted) is NOT auto-queued and NOT returned by pool-next — the
auto-fill/playback analogue of G8.

Loop status: cross-model pass 2 of ≤5. After the fix lands + re-verifies (incl. the new
direct-pollution tests via the forwarder), re-dispatch Codex for pass 3.

### B3 fix landed (2026-06-25) — re-advanced to review
Both read/playback paths now apply the creator scope at READ time (symmetric with B2/G8/listContent):

- **B3a — `autoFill`** (`playout-orchestrator.ts`): now calls `resolvePoolScope` first (fails closed
  on a missing channel) and, for creator scope, suppresses the playout arm entirely and constrains
  the content arm to `c.creator_id = scope.creatorId AND c.deleted_at IS NULL`. A polluted/foreign/
  deleted `channel_content` row is no longer an auto-fill candidate.
- **B3b — `resolvePoolNextUri`** (`editorial-control.ts`): the `void scope;` is gone. Creator scope
  now runs a scoped raw query joining `content` with `creator_id = scope.creatorId AND
  deleted_at IS NULL` (content-only, playout rows suppressed); platform/admin scope keeps the
  prior unconstrained channel-bounded select. The playback URI path can no longer serve a foreign/
  deleted row to viewers.

**Verification:**
- `bun run --filter @snc/api typecheck` clean; full unit suite **1866 passed**.
- Rewrote the `editorial-control` unit test `"works with creator scope descriptor (scope enforced at
  seed time)"` → `"creator scope queries via the scoped raw SQL path and resolves a content URI"`.
  The old test asserted the now-disproven "scope enforced at seed time" contract against a plain
  `channelContent` select; the new test asserts the scoped `db.execute` path runs and resolves the
  own-content URI. (Bad-test repair, not gaming — the contract changed for a security reason.)
- **New integration test G9** in `cross-tenant-isolation.test.ts`: directly pollutes `channel_content`
  with a foreign creator's content + a soft-deleted own row (both given real `mediaKey`s so they
  WOULD resolve a URI if scope were missing — the test has teeth), then asserts neither `autoFill`
  nor `resolvePoolNextUri` surfaces them, while A's own active content IS auto-queued + served.
  Cross-tenant suite now **13 passed**.

## Review (2026-06-25)

**Verdict**: Approve — advanced to done. The B3 read/playback-scope fix (commit 029e0fb) was the last open item; Codex cross-model pass 3 confirmed SAFE on both paths with no admin/platform regression, G9 verified to have teeth. Cross-tenant integration 13 green; API unit 1866 green; typecheck clean. The parked pre-existing `poolContentScope` null-creatorId fall-through (idea-poolcontentscope-null-creator-fallthrough) is tracked separately, not a regression of this story.
