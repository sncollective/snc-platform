---
id: unified-channel-model-creator-enablement-creator-content-playable
kind: story
stage: drafting
tags: [streaming, playout, media-pipeline]
parent: unified-channel-model-creator-enablement
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

## Notes
This is the remaining blocker keeping `unified-channel-model-creator-enablement` from `done` and the
`unified-channel-model` epic from closing. B2 (read-side `listContent` scope) was fixed inline in the
same review loop; this story carries B1 only.
