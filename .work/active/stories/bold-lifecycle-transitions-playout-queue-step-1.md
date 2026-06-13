---
id: bold-lifecycle-transitions-playout-queue-step-1
kind: story
stage: review
tags: [refactor, playout]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: bold-lifecycle-transitions-playout-queue
---

# Step 1: markPlayed + promoteNext — convert the hot path

Read the parent feature body for the full plan (scope boundary, signatures,
current/target states). This step is the feasibility proof on the hot path.

## Scope

- New module `apps/api/src/services/playout-queue-transitions.ts` with `markPlayed`
  (playing → played, UPDATE by id) and `promoteNext` (select lowest-position queued +
  promote; returns the promoted row or null). Plain exported functions, services style.
- Convert `onTrackStarted` and `skip` in `playout-orchestrator.ts` to call them. All
  reads, interleaved side effects (channelContent stats, `client.skipTrack`), thresholds
  stay in the orchestrator, same order.
- New `apps/api/tests/services/playout-queue-transitions.test.ts`
  (drizzle-chainable-mock pattern).

Behavior-preserving: same DB statements, same order, same conditions.

## Acceptance criteria

- [x] Build passes; full orchestrator test suite green **unchanged**.
- [x] Transition unit tests cover: markPlayed update shape; promoteNext with and
      without a queued entry (returns row / null).
- [x] `set({ status: "played" })` / `set({ status: "playing" })` no longer appear in
      `playout-orchestrator.ts`.

**Risk**: Medium (hot path) — **Rollback**: revert commit.

## Implementation notes

- New module: `apps/api/src/services/playout-queue-transitions.ts`
- New tests: `apps/api/tests/services/playout-queue-transitions.test.ts`
- `playout-orchestrator.ts`: added import for `markPlayed`/`promoteNext`; replaced the
  two inline `db.update(playoutQueue).set({ status: "played" })` calls with `await
  markPlayed(playing.id)` and the two inline select+update promote blocks with `await
  promoteNext(channelId)` in both `onTrackStarted` and `skip`. Removed unused `gt`
  import from drizzle-orm.
- No mock relocations: the orchestrator tests assert `mockDbUpdate` call counts and
  `setFn.mock.calls[N]` shapes. Those calls now flow through the transitions module,
  which shares the same `mockDbUpdate` mock (the doMock binding is on the db connection
  module, re-imported by the transitions module at test time). Assertion counts and
  shapes are unchanged.
- Test counts: 34 orchestrator tests (unchanged) + 14 new transition tests = 48 total.
