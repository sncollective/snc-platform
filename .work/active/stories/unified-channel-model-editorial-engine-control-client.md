---
id: unified-channel-model-editorial-engine-control-client
kind: story
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model-editorial-engine
depends_on: [unified-channel-model-editorial-engine-render]
release_binding: null
gate_origin: null
created: 2026-06-16
updated: 2026-06-16
---

# Control client extension — API → harbor editorial verbs

Implements **Unit 4** of `unified-channel-model-editorial-engine` (full design in the feature body).
The typed adapter for the new bespoke endpoints.

## Scope
- `apps/api/src/services/liquidsoap-client.ts`: extend `LiquidsoapClient` with `setMode(channelId, mode)`,
  `setPriority(channelId, tier)`, `armQueue(channelId, armed)` — all `Promise<Result<void, AppError>>` —
  calling the new endpoints with the `?secret=` query, reusing the existing `request` helper (timeout +
  structured error mapping).
- `apps/api/src/services/playout-topology.ts`: extend `harborChannelPaths` with `mode` / `priority` / `arm`.
- Mirror the new verbs in `createStubLiquidsoapClient`.

## Acceptance criteria
- [ ] Each verb hits the right path with the `?secret=` query and method.
- [ ] Failure / timeout / unconfigured map to `AppError` per the existing pattern.
- [ ] `harborChannelPaths` returns the new paths; one constant per side of the harbor contract.
- [ ] Stub client implements the new verbs (test parity).
