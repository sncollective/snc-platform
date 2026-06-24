---
id: unified-channel-model-creator-content-playable
kind: feature
stage: implementing
tags: [streaming, playout, media-pipeline]
parent: unified-channel-model
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-24
updated: 2026-06-24
---

# Make creator-owned content queueable and playable from the Programming pool

## Why (blocker surfaced in cross-model review)

The creator content pool's primary purpose — a creator queues and plays their own content — does
not work. Surfaced as blocker **B1** in the `unified-channel-model-creator-enablement` cross-model
(Codex) review pass 1, missed by the green unit suite + same-model reviewer because the cross-tenant
tests assert *isolation* (B's content stays out of A's pool), not *function* (A's content actually
plays), and the AC#5 live fix-verify was deferred.

Two concrete breaks:

- **Manual queue silently excludes creator content.** Creator content is pooled as `channel_content`
  rows with `content_id` set and `playout_item_id: null` (the `sourceType === "content"` branch,
  `editorial-surface.tsx` `handleAssignContent`). But `handlePlayNext` early-returns
  `if (!item.playoutItemId)` and the pool picker filters to `sourceType === "playout"` only
  (`pool-item-picker.tsx`). A creator can assign their content to the pool but has no way to play it.
- **Auto-fill hits a non-deferred FK violation on creator content.** Auto-fill aliases
  `cc.content_id AS playout_item_id` (`playout-orchestrator.ts`, auto-fill candidate query) and
  feeds those values into `enqueueBatch` → `playout_queue.playout_item_id`, which is
  `.notNull().references(playoutItems.id)` (`playout-queue.schema.ts`). A `content.id` is not a
  `playout_items.id`, so the insert throws; a creator channel whose pool is all creator content
  can't auto-fill at all.

Root: `playout_queue` only models playout-item rows; creator `content` was added to the *pool*
without a path to a playable queue row.

## Design fork (NOT pre-committed — for feature-design to weigh, grounded in the render path)

- **Option A — project creator content into a playout item.** Give pooled creator content a
  `playout_items` projection (a row, possibly a transcode/normalize step) so it rides the existing
  queue + Liquidsoap render unchanged. No queue schema change. Cost: a projection/ingest step and
  its lifecycle (what happens when the source content is edited/deleted).
- **Option B — widen the queue model to carry `content_id`.** Make `playout_queue` able to reference
  either a playout item or a content row (nullable FKs + a check constraint, or a polymorphic
  source). First-class creator content. Cost: schema migration + FK + `playout-queue-transitions`
  changes + Liquidsoap render must learn to resolve a `content` source.

Weigh against the actual Liquidsoap render path (`liquidsoap-render.ts`) and the
`playout-queue-transitions` callsites before committing. Follow `drizzle-migrations.md` for any
schema change (generate, never hand-write).

## Acceptance
- A creator can select their own pooled content in the queue picker and "play next" with it.
- Auto-fill on a creator channel whose pool is creator content inserts playable queue rows (no FK
  error, no unplayable rows).
- The queued creator content actually renders through Liquidsoap for the creator's channel.
- Cross-tenant isolation is preserved (the existing G1–G8 guarantees stay green).
- Live fix-verify (platform convention): the user confirms a creator driving their own queue with
  their own content in the running app — this is the AC#5 that was deferred and must close here.

## Design (feature-design 2026-06-24, interactive — grounded in the landed code)

**Chosen: Option B — widen the queue model.** Make `playout_queue` polymorphic exactly like
`channel_content` already is (both source FKs nullable + a CHECK that exactly one is set). User
confirmed B over the projection approach (A).

### Why B, and why it's low-risk (grounded, not assumed)
The grounding pass found the URI-resolution layer is **already polymorphic and already wired**:
- `channel_content` (the pool) already carries nullable `playoutItemId` + nullable `contentId`
  (`playout-queue.schema.ts:24-27`) — the pool is not the problem.
- `resolveContentUri` (`playout-orchestrator.ts:88-112`) **already resolves a playable S3 URI from
  EITHER `playoutItemId` (→ `selectPlayoutRenditionUri`) OR `contentId`
  (→ `transcodedMediaKey ?? mediaKey`)**, and the pool-next push (`pushTrack`, line 870) already
  calls it. `editorial-control.ts:358-372` is the same precedent on the live-state path.
- Liquidsoap is URI-driven over the HTTP pool-next endpoint (`liquidsoap-render.ts:60`), not bound
  to `playout_items`. It plays whatever `s3_uri` the API hands it.

So the ONLY single-source bottleneck is `playout_queue.playout_item_id` being `NOT NULL` + the two
`getChannelQueueStatus` reads that `.innerJoin(playoutItems)` (dropping any content row). Option A
(project content → a shadow `playout_items` row) was rejected: it adds shadow rows + a projection
lifecycle (re-sync on re-transcode, orphan cleanup on delete) for no gain, since the URI layer
already handles `content` natively. B is symmetric with the pool and carries no shadow state.

### Implementation Units

#### Unit 1 — Widen the `playout_queue` schema (trickiest; lands first as its own regression gate)
**Story**: `unified-channel-model-creator-content-playable-schema`
**Files**: `apps/api/src/db/schema/playout-queue.schema.ts`, generated migration via
`drizzle-kit generate` (NEVER hand-write — see `drizzle-migrations.md`).

Change `playoutItemId` to nullable, add nullable `contentId` referencing `content.id`
(`onDelete: "cascade"`), and add a table CHECK that exactly one source is set — mirroring
`channel_content`:

```ts
playoutItemId: text("playout_item_id").references(() => playoutItems.id, { onDelete: "cascade" }),
contentId: text("content_id").references(() => content.id, { onDelete: "cascade" }),
// table extras:
check("playout_queue_one_source", sql`num_nonnulls(playout_item_id, content_id) = 1`),
```

**Acceptance**: migration generated + applied clean; existing rows (all playout-item) satisfy the
CHECK; a row with both-null or both-set is rejected by the DB. Existing admin playout queue behavior
unchanged (every admin row sets `playout_item_id`, `content_id` null).

#### Unit 2 — Make the queue transitions source-polymorphic (backend)
**Story**: `unified-channel-model-creator-content-playable-transitions` (depends_on: schema)
**Files**: `apps/api/src/services/playout-queue-transitions.ts`.

`enqueue`, `enqueueBatch`, and `markPlayed`/`promoteNext` currently take `playoutItemId: string`.
Change the source param to a discriminated union and write the right column:

```ts
type QueueSource = { playoutItemId: string } | { contentId: string };
// enqueue({ channelId, source: QueueSource, position? })
// enqueueBatch(channelId, sources: QueueSource[])
```

Insert `playoutItemId` OR `contentId` per the source (the CHECK enforces exactly-one). All five
publish callsites + the `content.playout-changed` creator scoping (already landed) are unchanged.

**Acceptance**: enqueue/enqueueBatch accept a content source and write a `content_id` row with
`playout_item_id` null; admin playout-item path unchanged; the CHECK is never violated.

#### Unit 3 — Fix the queue-status reads + auto-fill + insert chokepoint (backend)
**Story**: `unified-channel-model-creator-content-playable-reads` (depends_on: schema; parallel with Unit 2)
**Files**: `apps/api/src/services/playout-orchestrator.ts`.

- `getChannelQueueStatus` (lines ~192, ~248): the `.innerJoin(playoutItems, …)` DROPS content rows.
  Convert to LEFT joins against both `playout_items` and `content`, coalescing title/duration/
  sourceType (same shape as the G8 `listContent` UNION). `toQueueEntry` learns `contentId` +
  `sourceType`.
- Auto-fill candidate query (line ~776): STOP aliasing `cc.content_id AS playout_item_id`. Carry the
  real source type and feed `enqueueBatch` typed `QueueSource[]` (Unit 2). This is the FK-violation
  fix.
- `insertIntoQueue` creator chokepoint (line ~401): already requires the item be in the channel's
  scoped pool — generalize the membership check to match on the correct column (content vs playout).

**Acceptance**: a creator channel whose pool is all creator content auto-fills playable rows (no FK
error); queue status lists content rows with correct title/duration; the pool chokepoint still
rejects items not in the channel's scoped pool (G4 stays green).

#### Unit 4 — Unblock the manual-queue UI for creator content (frontend)
**Story**: `unified-channel-model-creator-content-playable-ui` (depends_on: reads, transitions)
**Files**: `apps/web/src/components/playout/editorial-surface.tsx`,
`apps/web/src/components/admin/pool-item-picker.tsx`, the creator playout route + client lib.

- `pool-item-picker.tsx:66`: drop the `sourceType === "playout"` filter — content is now queueable.
- `editorial-surface.tsx` `handlePlayNext`: stop early-returning on `!item.playoutItemId`; send the
  right source (`contentId` for content rows). The insert API route + client take a discriminated
  source.
- Creator playout insert route (`creator-playout.routes.ts` queue/items) + admin equivalent: accept
  `{ playoutItemId }|{ contentId }` (validator update).

**Acceptance**: a creator selects their own pooled content in the picker and "play next" works;
admin can still queue playout items unchanged.

## Implementation Order
1. Unit 1 — schema (regression gate; everything else needs the columns + CHECK)
2. Unit 2 — transitions + Unit 3 — reads/auto-fill (parallel; both depend only on schema)
3. Unit 4 — UI (depends on 2 + 3)

## Testing
- **Unit 1**: migration applies; CHECK rejects both-null/both-set (integration).
- **Unit 2/3**: extend the orchestrator unit tests + the cross-tenant integration suite — a creator
  queueing/auto-filling their OWN content produces playable `content_id` rows; **the G1–G8
  cross-tenant guarantees stay green** (content scoping must survive the widening); auto-fill on an
  all-content pool inserts rows without FK error.
- **Unit 4**: picker shows content; play-next on content fires the content source.
- **AC#5 live fix-verify (the deferred one)**: user confirms a creator driving their own queue with
  their own content in the running app — closes here.

## Risks
- **Cross-tenant regression during the widening.** The content-scoping guarantees (G1–G8) were the
  whole point of the prior review rounds; the queue widening must not reopen a leak. Mitigation: the
  cross-tenant integration suite runs against every backend unit; insert chokepoint membership check
  stays pool-scoped.
- **The CHECK constraint on existing data.** Every existing `playout_queue` row must already satisfy
  `num_nonnulls = 1` (they all set `playout_item_id`). Verify before the migration; it should be a
  no-op for existing rows.
- **`onDelete: cascade` on `content_id`.** Deleting content cascades its queue rows — acceptable
  (a deleted content can't play), matches `channel_content`'s behavior.

## Notes
This is the remaining blocker keeping `unified-channel-model-creator-enablement` from `done` and the
`unified-channel-model` epic from closing. B2 (read-side `listContent` scope) was fixed inline in the
same review loop; this story carries B1 only. After implementation, the cross-model peer-review loop
resumes (pass 2) on the full fix set before the feature can advance.
