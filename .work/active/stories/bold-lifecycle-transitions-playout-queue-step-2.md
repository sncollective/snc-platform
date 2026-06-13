---
id: bold-lifecycle-transitions-playout-queue-step-2
kind: story
stage: done
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

- [x] Build passes; orchestrator suite green unchanged.
- [x] Transition unit tests: enqueue position-given branch (shift first), append
      branch (MAX over live rows), batch consecutive positions.
- [x] `insert(playoutQueue)` no longer appears in `playout-orchestrator.ts`.

**Risk**: Low — **Rollback**: revert commit.

## Implementation notes

- `enqueue` and `enqueueBatch` were already written in the transitions module (Step 1
  created the full module). This step connects the orchestrator call sites.
- `insertIntoQueue`: replaced the inline position-shift UPDATE + MAX select + INSERT
  block with `await enqueue({ channelId, playoutItemId, position })`. Item validation
  (NotFound check) and response mapping (`toQueueEntry`) stay in the orchestrator.
- `autoFill`: replaced the MAX select + `newEntries` map + `db.insert(playoutQueue).values`
  block with `await enqueueBatch(channelId, candidateRows.map(r => r.playout_item_id))`.
  Candidate selection SQL stays in the orchestrator. Log message and fields are identical
  (`{ channelId, added }` — `added` was `newEntries.length`, now the return value of
  enqueueBatch, same count).
- Removed unused `gte` drizzle-orm import.
- No mock relocations: the orchestrator tests mock `mockDbSelect`/`mockDbInsert` at the
  db connection level; enqueueBatch reads through the same shared mocks, preserving all
  existing assertions.
- Test counts: 34 orchestrator (unchanged) + 14 transition (unchanged) = 48 total.

## Review (2026-06-13)
**Verdict**: Approve — fast-lane advance. Verified at the feature-level deep review:
verbatim extraction, orchestrator test assertions untouched, suite green.
