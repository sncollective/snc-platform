---
id: bold-lifecycle-transitions-playout-queue-step-1
kind: story
stage: implementing
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

- [ ] Build passes; full orchestrator test suite green **unchanged**.
- [ ] Transition unit tests cover: markPlayed update shape; promoteNext with and
      without a queued entry (returns row / null).
- [ ] `set({ status: "played" })` / `set({ status: "playing" })` no longer appear in
      `playout-orchestrator.ts`.

**Risk**: Medium (hot path) — **Rollback**: revert commit.
