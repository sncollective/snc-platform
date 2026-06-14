---
id: playout-admin-redesign-honest-actions-queue-honesty
kind: story
stage: done
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

## Implementation notes (2026-06-13)

**Files changed:**
- `apps/web/src/components/admin/queue-item-row.tsx` — `estimateLabel` updated:
  `estimatedStart === 0 → "Up next"`, `estimatedStart !== null → "est. HH:MM:SS"`,
  `null → "—"`.
- `apps/web/src/components/admin/pool-item-picker.tsx` — empty state for
  `queueableItems.length === 0` now renders the full explanatory sentence:
  "Only playout-uploaded items can be queued. Creator content plays via the rotation pool."
- `apps/web/src/routes/admin/playout.tsx` — Now Playing section: when
  `queueStatus !== null` and `nowPlaying === null`, renders "Nothing playing" status
  + a disabled Skip button with adjacent muted "No active track" span in a
  `skipDisabledGroup`; when `nowPlaying != null`, enabled Skip unchanged; when
  `queueStatus === null`, "Loading…" without Skip (unchanged).
- `apps/web/src/routes/admin/playout.module.css` — added `.skipDisabledGroup` and
  `.skipDisabledReason` classes (from Unit 1 commit; included there for CSS coherence).

**New test files:**
- `apps/web/tests/unit/components/admin/queue-item-row.test.tsx` — "Up next"/est/—/
  positive-not-zero label cases.
- `apps/web/tests/unit/components/admin/pool-item-picker.test.tsx` — empty-state
  explanatory note (empty pool, content-only pool, playout items present).

**Note on Now Playing changes:** The `queueStatus === null` (loading) state had
no Skip button previously — that behavior is preserved. The new disabled-skip state
only fires when `queueStatus !== null && nowPlaying === null`.

**Fix-verify loopback:** User to confirm in the running app: "Up next" label on first
queue item, picker empty-state note, disabled Skip with "No active track" when nothing
plays.

## Fix-verify (2026-06-13 — user confirmed in-app)
User confirmed in the running app (/admin/playout):
- Empty "add to queue" picker shows the explanation: "No playout items in pool. Only
  playout-uploaded items can be queued. Creator content plays via the rotation pool." ✓
- Now Playing with nothing playing: Skip is disabled with a "No active track" reason. ✓
- Queue empty state shows "Queue empty — content pool will auto-play." ✓
The "Up next" first-item label could NOT be eyeballed (no queueable item — the dev playout
chain isn't airing pooled content; separate dev-env gap, see backlog). It is unit-verified
in queue-item-row.test.tsx (estimatedStart === 0 → "Up next"). Closed review -> done on
2/3 visual confirmations + 1 unit-verified-visual-deferred.
