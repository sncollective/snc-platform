---
id: gate3-tests-queue-status-concurrent-contract
kind: story
stage: done
tags: [testing]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: tests
created: 2026-06-29
updated: 2026-06-29
---

# Queue-status concurrent-read contract is not directly tested

## Priority
Critical

## Spec reference
Item: `gate2-refactor-queue-status-concurrent-awaits` — Promise.all on independent reads after channel guard.

## Suggested test
`apps/api/tests/services/playout-queue-status.test.ts` (or playout-orchestrator.test.ts): deferred DB-chain promises assert both queue/pool reads invoked concurrently + correct shape out-of-order; channel-guard-no-row → NOT_FOUND, no reads.

## Test location
`apps/api/tests/services/playout-queue-status.test.ts`

## Implementation (2026-06-29)
Added `apps/api/tests/services/playout-queue-status.test.ts` with deferred Drizzle-chain promises proving single-channel queue/pool reads start concurrently after the channel guard, the guard short-circuits to `NOT_FOUND` without extra reads, and multi-channel channel/queue/pool reads are started before any deferred query resolves.

## Review (2026-06-29)

**Verdict**: Approve. Fast-lane (rerun-2 finding, green — full suite: shared + api 117 + web build/test). No blockers.
