---
id: bold-lifecycle-transitions-playout-queue-step-2
kind: story
stage: implementing
tags: [refactor, playout]
release_binding: null
depends_on: [bold-lifecycle-transitions-playout-queue-step-1]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: bold-lifecycle-transitions-playout-queue
---

# Step 2: enqueue + enqueueBatch — convert insert and auto-fill

Read the parent feature body for the full plan.

## Scope

- Add `enqueue({ channelId, playoutItemId, position? })` (absorbs the position-shift
  UPDATE branch and the MAX(position) append branch + INSERT...returning) and
  `enqueueBatch(channelId, playoutItemIds)` (MAX read + batch INSERT) to
  `playout-queue-transitions.ts`.
- Convert `insertIntoQueue` (item validation + response mapping stay) and `autoFill`
  (candidate selection stays) in the orchestrator.
- `pushedToLiquidsoap: false` remains part of the insert values (birth bookkeeping).

Behavior-preserving: statement-for-statement identical, same order.

## Acceptance criteria

- [ ] Build passes; orchestrator suite green unchanged.
- [ ] Transition unit tests: enqueue position-given branch (shift first), append
      branch (MAX over live rows), batch consecutive positions.
- [ ] `insert(playoutQueue)` no longer appears in `playout-orchestrator.ts`.

**Risk**: Low — **Rollback**: revert commit.
