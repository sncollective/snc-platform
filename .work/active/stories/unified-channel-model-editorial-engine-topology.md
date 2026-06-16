---
id: unified-channel-model-editorial-engine-topology
kind: story
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model-editorial-engine
depends_on: [unified-channel-model-editorial-engine-config-schema]
release_binding: null
gate_origin: null
created: 2026-06-16
updated: 2026-06-16
---

# Topology model extension — editorial tiers + channel-as-source resolution

Implements **Unit 2** (the trickiest unit) of `unified-channel-model-editorial-engine` (full design in
the feature body). Pure data — turns editorial config into render-ready typed topology.

## Scope
- `apps/api/src/services/playout-topology.ts`: add `EditorialTier` discriminated union (live / queue /
  pool / channel-as-source-with-resolved-`sourceLiqVar`); extend `PlayoutChannelTopology` with `mode`,
  `manualTierIndex`, `tiers` (priority order, 0 = highest).
- Grow `buildPlayoutTopology` to take editorial config alongside channel rows; resolve channel-as-source
  tiers to the referenced channel's `liqVar`-derived `_source`; **emit channel blocks in topological
  order** so a referenced `_source` is defined before any block referencing it.
- Run `detectChannelSourceCycles` first — a cycle is a hard build error (no valid topo order exists).
- Stays pure: no DB / fs / config reads; the caller passes config in.

## Acceptance criteria
- [ ] Tiers map to the typed union; priorities preserved (0 = highest).
- [ ] channel-as-source resolves to the correct referenced `_source` var.
- [ ] Channel blocks are topologically ordered (referenced channels precede referrers).
- [ ] Cycle input is rejected at build (hard error).
- [ ] `mode` + `manualTierIndex` carried through correctly.
- [ ] Pure-function tests only (no DB/fs).
