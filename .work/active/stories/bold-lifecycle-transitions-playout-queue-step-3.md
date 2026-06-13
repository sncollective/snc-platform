---
id: bold-lifecycle-transitions-playout-queue-step-3
kind: story
stage: review
tags: [refactor, playout]
release_binding: null
depends_on: [bold-lifecycle-transitions-playout-queue-step-2]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: bold-lifecycle-transitions-playout-queue
---

# Step 3: removeQueued + single-writer structural test

Read the parent feature body for the full plan (incl. the scope boundary: the cleanup
job's purge of terminal `played` rows is deliberately OUTSIDE the invariant).

## Scope

- Add `removeQueued(entry)` to the transitions module — takes the already-loaded row
  (no re-read), keeps the `status === "playing"` → 409 CANNOT_REMOVE_PLAYING guard +
  DELETE, returns `Result<void, AppError>`. Convert `removeFromQueue` (NotFound
  mapping stays in the orchestrator).
- New structural test `apps/api/tests/services/playout-queue-single-writer.test.ts`:
  fs-walk over `apps/api/src` asserting queue-status write expressions (`set({ status:`
  against playoutQueue, and status literals in `insert(playoutQueue)` values) appear
  only in `playout-queue-transitions.ts`. Allowlist the schema file. This enforces the
  epic's "stray writes become grep-detectable".

## Acceptance criteria

- [x] Build passes; orchestrator + cleanup-job suites green unchanged.
- [x] Structural test passes; verified to fail on a temporarily introduced stray write
      (not committed).
- [x] Remaining `update(playoutQueue)` in the orchestrator only sets
      `pushedToLiquidsoap` or `position`.

**Risk**: Low — **Rollback**: revert commit.

## Implementation notes

- `removeFromQueue` in the orchestrator: kept the load + NotFound mapping, replaced
  the inline `status === "playing"` guard + DELETE block with `return removeQueued(entry)`.
  `removeQueued` was already in the transitions module (written in Step 1).
- New structural test: `apps/api/tests/services/playout-queue-single-writer.test.ts`
  (4 tests). Uses two grep heuristics over `apps/api/src/**/*.ts`:
  - Heuristic A: file contains both `playoutQueue` and `set({ status:` — catches UPDATE status writes.
  - Heuristic B: file contains `insert(playoutQueue)` and a `status: "queued/playing/played"`
    literal — catches INSERT live-row creations.
  - Allowlist: schema file (column default), transitions module (the owner).
  - Tripwire: verified the test fails when a stray comment with the pattern is introduced
    in the orchestrator (not committed). The cleanup job passes because it only reads
    status via `eq()` and deletes by id — never has `set({ status:` or `insert(playoutQueue)`.
- Remaining `update(playoutQueue)` in orchestrator: L696 (`pushedToLiquidsoap: true` in
  pushPrefetchBuffer) and L803 (`pushedToLiquidsoap: false` in initialize). Both are
  delivery-bookkeeping, not lifecycle writes.
- Full suite: 104 test files, 1567 tests passing. Build: clean.
- Test counts: 34 orchestrator (unchanged) + 14 transition + 4 structural = 52 new total.
