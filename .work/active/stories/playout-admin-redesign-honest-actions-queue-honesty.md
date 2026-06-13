---
id: playout-admin-redesign-honest-actions-queue-honesty
kind: story
stage: implementing
tags: [playout, admin-console]
release_binding: null
depends_on: [playout-admin-redesign-responsive-structure-form-and-chrome]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: playout-admin-redesign-honest-actions
---

# Queue honesty copy — Up next, picker note, disabled skip

## Scope
Unit 2 of the parent feature: `QueueItemRow` renders "Up next" at cumulative-zero
estimate; `PoolItemPicker`'s empty state explains the playout-only filter; the Now
Playing section renders a disabled Skip with a visible "No active track" reason
instead of hiding the affordance. Exact expressions and acceptance criteria in the
parent feature body.

## Coordination
Writes `playout.tsx` — depends on responsive-structure's form-and-chrome story
(declared); bundle or serialize with sibling `…-channel-lifecycle` (same file).

## Resume note (2026-06-13)
Designed, not implemented; dep satisfied (responsive-structure archived). Pure copy/
affordance changes (`QueueItemRow`, `PoolItemPicker`, the Now Playing skip block) —
lower migration exposure than the channel-lifecycle sibling, but still re-read
`playout.tsx` against current HEAD before implementing. See the parent feature's
`## Resume note`.
