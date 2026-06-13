---
id: bold-lifecycle-transitions-playout-queue-step-3
kind: story
stage: implementing
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

- [ ] Build passes; orchestrator + cleanup-job suites green unchanged.
- [ ] Structural test passes; verified to fail on a temporarily introduced stray write
      (not committed).
- [ ] Remaining `update(playoutQueue)` in the orchestrator only sets
      `pushedToLiquidsoap` or `position`.

**Risk**: Low — **Rollback**: revert commit.
