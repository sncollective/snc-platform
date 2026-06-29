---
id: creator-channel-engine-e2e-infra-topology
kind: story
stage: done
tags: [testing, streaming, playout, developer-experience]
parent: creator-channel-engine-e2e-infra
depends_on: []
release_binding: 0.4.0
gate_origin: null
created: 2026-06-28
updated: 2026-06-28
---

# Creator-channel playback e2e: engine topology/test-profile inclusion

## Scope

In an explicit e2e/test profile, include selected active creator `live-ingest` channels in Liquidsoap
config generation as queue-capable output channels. Default runtime must keep excluding creator
channels from the rendered playout engine.

## Implementation targets

- `apps/api/src/services/liquidsoap-config.ts`
- `apps/api/src/services/liquidsoap-render.ts` only if needed to preserve/verify non-broadcast live-tier deferral
- `apps/api/src/config.ts` if no explicit e2e/test-profile switch exists yet
- tests near existing Liquidsoap config/render coverage

## Acceptance criteria

- [x] Default config generation still excludes creator `live-ingest` channels.
- [x] E2E/test profile can include Maya's creator channel or a deterministic test creator channel in
      rendered topology.
- [x] Rendered creator block has queue/pool/HLS output plumbing but no per-channel live RTMP listener.
- [x] Any profile switch is explicit and safe-by-default.

## Implementation notes

- `generateLiquidsoapConfig()` now widens the channel query only when the existing explicit
  `AUTH_RATE_LIMIT_PROFILE=e2e` test profile is active; default `strict` keeps the existing
  `playout`/`broadcast` role filter.
- The e2e-only branch admits active creator-owned `role="live-ingest"` rows into the topology and
  keeps an in-process filter matching the SQL predicate so the safe-by-default split is unit-testable
  without a real DB.
- No renderer live-ingest behavior was changed: creator rows render as ordinary non-broadcast queue
  channels, so queue/pool/RTMP-to-SRS output and track-event callbacks are present, while `live` tiers
  on non-broadcast channels continue to be skipped and do not emit per-channel `input.rtmp` listeners.
- Added focused Liquidsoap config tests for default creator exclusion and explicit e2e inclusion using
  a deterministic `Live: Maya` creator channel fixture with a deferred live tier plus queue tier.

## Verification

- `bun run --filter @snc/api test:unit -- tests/services/liquidsoap-config.test.ts` — passed
  (24 tests).
- `bun run --filter @snc/api typecheck` — passed.

## Test integrity contract

Park real product bugs; fix bad fixtures/assertions; never weaken render assertions to match accidental
output.

## Review (2026-06-28)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none

**Notes**: Fast-lane story review. Implementation notes record focused Liquidsoap config tests and API typecheck passing; acceptance criteria are all checked and the story preserves the safe-by-default runtime behavior.
