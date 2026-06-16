---
id: unified-channel-model-editorial-engine-topology
kind: story
stage: done
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
- [x] Tiers map to the typed union; priorities preserved (0 = highest).
- [x] channel-as-source resolves to the correct referenced `_source` var.
- [x] Channel blocks are topologically ordered (referenced channels precede referrers).
- [x] Cycle input is rejected at build (hard error).
- [x] `mode` + `manualTierIndex` carried through correctly.
- [x] Pure-function tests only (no DB/fs).

## Implementation notes

### Files changed
- `apps/api/src/services/playout-topology.ts` — added `PlayoutEditorialTier` discriminated union; extended `PlayoutChannelTopology` with `mode`, `manualTierIndex`, `tiers`; added `resolveEditorialTier` and `topoSort` private helpers; grew `buildPlayoutTopology` to take `editorialConfigs: readonly EditorialConfigWithTiers[]` as second required parameter.
- `apps/api/src/services/liquidsoap-config.ts` — added `getAllEditorialConfigs()` import; updated `generateLiquidsoapConfig` to fetch editorial configs concurrently with channels via `Promise.all`; passes configs to `buildPlayoutTopology`. Editorial config failure degrades gracefully to queue-only defaults with a warn log rather than blocking config generation.
- `apps/api/tests/services/playout-topology.test.ts` — updated all existing `buildPlayoutTopology([...])` calls to `buildPlayoutTopology([...], [])`; added new describe blocks: config-less default, tier type mapping (live/queue/pool/channel-as-source), mode+manualTierIndex, topological ordering (no-edges preserves input order; single carry; chain A→B→C), and cycle detection (self-loop, 2-cycle, unknown reference).
- `apps/api/tests/services/liquidsoap-config.test.ts` — added `mockGetAllEditorialConfigs` mock and `editorial-config.js` module mock in `setupModule`; default returns `{ ok: true, value: [] }`.

### Tests added (new pure unit tests)
20 new test cases in `playout-topology.test.ts` across 5 new describe blocks.

### Config-less channel default decision
Channels with no config row OR with a config row but empty tiers default to `mode: "auto"`, `tiers: [{type: "queue", queueId: <its queueId>}]`, `manualTierIndex: null`. This preserves the existing degenerate queue-only render behavior for all currently-deployed channels.

### Cycle error style chosen
`buildPlayoutTopology` throws (plain `Error`) on cycle detection. The function is not `Result`-typed (it's a pure synchronous builder returning `PlayoutTopology` directly). Cycles at topology-build time are invariant violations — config-schema already rejects them on write; this is defense-in-depth. `generateLiquidsoapConfig` is async and allows the throw to propagate as a 500.

### Topological sort
Kahn's algorithm with input-order as the tiebreaker. The fast path (no channel-as-source edges) returns the input array unchanged — no mutation, no sort, byte-identical channel order for the render. Tested: no-edges preserves order; single carry puts referenced before referrer; chain A→B→C correctly orders even when input order is C,B,A.

### `sourceLiqVar` reverse mapping in topoSort
`topoSort` needs `channelId → sourceChannelId` edges but only has access to resolved `PlayoutChannelTopology` with `sourceLiqVar` strings. The reverse mapping (`ch_<id_underscores>_source` → UUID with hyphens) is safe for UUID-shaped IDs (no ambiguity between original hyphens and replacement underscores, since UUID segments contain only hex chars). Future channel IDs that are not UUIDs would need the edge list threaded through separately — parked as a known fragility if non-UUID IDs are ever adopted.

### Golden snapshots
All four `.liq` snapshot files (`playout-0ch.liq`, `playout-1ch.liq`, `playout-2ch.liq`, `playout-special-chars.liq`) are byte-identical after this change. Verified: `git diff --name-only -- apps/api/tests/services/__snapshots__/` returns empty.

### Test results
112 test files, 1683 tests — all pass.

## Review (2026-06-16)

**Verdict**: Approve with comments

**Blockers**: none

**Important** (filed → `editorial-config-review-followups` backlog §"From topology review"; none block the chain):
- `topoSort` reverse-maps `sourceLiqVar → channelId` instead of using the edge data already available
  from the config at build time — correct for UUID ids, fragile otherwise.
- Plain `Error` thrown in 4 spots — violates the typed-`AppError` convention.
- `resolveSourceVar` throwing on an unknown referenced channel fails the whole render, not just the bad
  tier (edge case; FK cascade mostly prevents dangling refs).

**Nits**: `liquidsoap-config.ts` degrades editorial-config fetch failures to queue-only + warn — a
reasonable best-effort choice now; revisit fail-loud-vs-degrade once the render consumes tiers.

**Notes**: Substrate review — read the new helpers (`resolveEditorialTier`, `topoSort`, the grown
`buildPlayoutTopology`) + the `liquidsoap-config.ts` caller change + test titles. Confirmed: Kahn's
topo sort is correct and stable (input-order tiebreak, fast-path preserves order → goldens byte-identical,
verified empty `__snapshots__` diff); config-less channels default to queue-only auto (preserves current
render); the 20 new tests assert real behavior (no gaming). The findings are quality/fragility, not
correctness, for the current UUID-id scheme.
