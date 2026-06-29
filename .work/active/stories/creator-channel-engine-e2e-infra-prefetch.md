---
id: creator-channel-engine-e2e-infra-prefetch
kind: story
stage: done
tags: [testing, streaming, playout, developer-experience]
parent: creator-channel-engine-e2e-infra
depends_on: [creator-channel-engine-e2e-infra-topology]
release_binding: null
gate_origin: null
created: 2026-06-28
updated: 2026-06-28
---

# Creator-channel playback e2e: startup/prefetch support

## Scope

Ensure e2e-selected creator channels receive the queue initialization/prefetch treatment needed for
queued content to reach Liquidsoap and trigger the real `track-event → nowPlaying` path.

## Implementation targets

- `apps/api/src/services/playout-orchestrator.ts`
- `apps/api/src/jobs/register-workers.ts` if startup wiring needs profile-aware initialization
- focused service/API tests for initialize and prefetch behavior

## Acceptance criteria

- [x] Default startup still initializes ordinary playout channels only.
- [x] E2E/test profile initializes selected creator channels enough for queued content playback.
- [x] Existing creator queue operations still go through the shared orchestrator.
- [x] Creator ownership and cross-tenant isolation remain enforced by channel ownership, not caller input.

## Test integrity contract

Park real product bugs; repair bad tests in-session; do not bypass ownership checks to make playback setup easy.

## Implementation notes

- Files changed:
  - `apps/api/src/services/playout-orchestrator.ts`
  - `apps/api/tests/services/playout-orchestrator.test.ts`
- Tests added/updated:
  - `playout-orchestrator.test.ts` now covers default startup filtering of creator `live-ingest` rows.
  - `playout-orchestrator.test.ts` now covers e2e-profile startup prefetch of queued creator content through the shared orchestrator/client path.
- Discrepancies from design: none.
- Adjacent issues parked: none.

## Verification

- `bun run --filter @snc/api test:unit -- tests/services/playout-orchestrator.test.ts` — pass (47 tests).
- `bun run --filter @snc/api build` — pass (`API runs via tsx — no build step needed`).
- `bun run --filter @snc/api test:unit` — fails on unrelated in-progress test-control changes outside this story: `tests/config.test.ts` expects no `TEST_CONTROL_PROFILE`, and `tests/services/playout-queue-single-writer.test.ts` flags untracked `src/services/test-control.ts`.

## Review (2026-06-28)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none

**Notes**: Fast-lane story review. Targeted orchestrator tests and API build passed. Full API unit suite failure is attributed to concurrent in-progress `e2e-harness-determinism-test-control-api` working-tree changes outside this story, not to the committed prefetch changes.
