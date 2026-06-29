---
id: bold-event-spine-publishers-queue-events
kind: story
stage: done
tags: [streaming, playout]
release_binding: 0.4.0
depends_on: [bold-event-spine-publishers-input-switch]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: bold-event-spine-publishers
---

# Queue + engine publishers

Unit 2 of the parent feature design.

## Scope

- Shared union additions: `playout.queue-changed {channelId}`,
  `playout.now-playing-changed {channelId}`, `playout.engine-restarted {}`.
- Registry entries (topic `playout`; coalesce by channelId / channelId / static
  `"engine"`).
- Publishes inside the transitions module (`markPlayed` + `promoteNext` →
  now-playing-changed; `enqueue` + `enqueueBatch` (count > 0) + `removeQueued` success
  → queue-changed) — the module is the named side-effect attachment point; do NOT
  publish from orchestrator call sites.
- `regenerateAndRestart` success → engine-restarted.

## Acceptance criteria

- [x] Transition unit tests assert publishes (spy bus); existing assertions unweakened;
      orchestrator suite green unchanged.
- [x] Exhaustive-registry compile check holds (new union members force entries).
- [x] Fire-and-forget: a throwing bus (forced in test) does not fail a transition.

## Implementation notes (2026-06-13)

**Emission-asymmetry decision:** `markPlayed` returns void — extended its signature to accept
`channelId: string` (second param) so the module can publish without re-querying. The two
orchestrator call sites pass `playing.channelId` from the already-loaded row. `enqueueBatch`
returns count (publish only when count > 0). `enqueue` publishes only when INSERT returns a row.
`removeQueued` had its entry param extended with `channelId: string`; orchestrator's
`removeFromQueue` already selects full rows including `channelId`.

**Pre-existing typecheck gap fixed inline:** `playout-orchestrator.ts` line 346 was passing
`position: number | undefined` to `enqueue({ position?: number })` — illegal under
`exactOptionalPropertyTypes`. Fixed with conditional spread `...(position !== undefined ? { position } : {})`.

**Files changed:**
- `packages/shared/src/events.ts` — 3 new schemas + extended discriminated union
- `apps/api/src/services/event-bus.ts` — 3 new EVENT_REGISTRY entries; exhaustive-check holds
- `apps/api/src/services/playout-queue-transitions.ts` — eventBus import; publishes at all 5 transitions; `markPlayed`/`removeQueued` signature extended with channelId
- `apps/api/src/services/liquidsoap-config.ts` — eventBus import; publish after successful restart
- `apps/api/src/services/playout-orchestrator.ts` — `markPlayed` call sites updated; pre-existing typecheck fix
- `apps/api/tests/services/playout-queue-transitions.test.ts` — event-bus mock in setupModule; 10 new publish/fire-and-forget tests; existing tests updated for new signatures
- `apps/api/tests/services/liquidsoap-config.test.ts` — event-bus mock + 2 new publish tests
- `apps/api/tests/routes/sse.routes.test.ts` — `EventBus` type import + `makeMockBus` return type fix

**Test results:**
- playout-queue-transitions.test.ts: 28 tests ✓ (was 18, +10 new)
- liquidsoap-config.test.ts: 21 tests ✓ (was 19, +2 new)
- sse.routes.test.ts: all existing tests ✓ (typecheck fix only, no test changes)
- Full API suite: 1588 passed; 14 fails all in `local-storage.test.ts` (pre-existing sandbox
  restriction on `/tmp` — unrelated to this unit)

## Review (2026-06-14)
**Verdict**: Approve — fast-lane: green unit verification (spy-bus publishes; exhaustive registry compile-check holds; emission-asymmetry resolved at call sites).
