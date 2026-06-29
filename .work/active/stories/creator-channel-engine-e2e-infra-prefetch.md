---
id: creator-channel-engine-e2e-infra-prefetch
kind: story
stage: implementing
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

- [ ] Default startup still initializes ordinary playout channels only.
- [ ] E2E/test profile initializes selected creator channels enough for queued content playback.
- [ ] Existing creator queue operations still go through the shared orchestrator.
- [ ] Creator ownership and cross-tenant isolation remain enforced by channel ownership, not caller input.

## Test integrity contract

Park real product bugs; repair bad tests in-session; do not bypass ownership checks to make playback setup easy.
