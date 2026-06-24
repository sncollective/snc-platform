---
id: unified-channel-model-creator-content-playable-reads
kind: story
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model-creator-content-playable
depends_on: [unified-channel-model-creator-content-playable-schema]
release_binding: null
gate_origin: null
created: 2026-06-24
updated: 2026-06-24
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
- [ ] A creator channel whose pool is all creator content auto-fills PLAYABLE rows — no FK error, no unplayable rows.
- [ ] Queue status lists content rows with correct title/duration/sourceType.
- [ ] The pool chokepoint still rejects items not in the channel's scoped pool (cross-tenant G4 stays green).
- [ ] Cross-tenant guarantees G1–G8 stay green (content scoping survives the read changes).
