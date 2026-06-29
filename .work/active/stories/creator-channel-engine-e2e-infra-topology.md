---
id: creator-channel-engine-e2e-infra-topology
kind: story
stage: implementing
tags: [testing, streaming, playout, developer-experience]
parent: creator-channel-engine-e2e-infra
depends_on: []
release_binding: null
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

- [ ] Default config generation still excludes creator `live-ingest` channels.
- [ ] E2E/test profile can include Maya's creator channel or a deterministic test creator channel in
      rendered topology.
- [ ] Rendered creator block has queue/pool/HLS output plumbing but no per-channel live RTMP listener.
- [ ] Any profile switch is explicit and safe-by-default.

## Test integrity contract

Park real product bugs; fix bad fixtures/assertions; never weaken render assertions to match accidental
output.
