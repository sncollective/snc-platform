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
updated: 2026-06-17
---

# Topology model extension — editorial tiers + channel-as-source resolution

Implements **Unit 2** (the trickiest unit) of `unified-channel-model-editorial-engine` (full design in
the feature body). Pure data — turns editorial config into render-ready typed topology.

## Bounce (deep feature review, 2026-06-17) — reopened `done → implementing`

**B2 — manual-tier index-space mismatch → silence** (full detail in the feature body §Review findings):
`buildPlayoutTopology` computes `manualTierIndex` via `config.tiers.findIndex` (the FULL tier array), but
the render indexes `tierVarNames` (enabled-filtered) and the service computes the enabled-filtered index.
When a disabled tier precedes the pinned tier the spaces diverge → render-init pins out-of-range →
`mksafe(blank())` (silence) on restart. Fix: compute `manualTierIndex` over the enabled tiers (same array
the render + service use). Add a topology test with a disabled tier *before* the pinned tier (existing
tests use fully-enabled tiers, so the bug hides).

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

## Revision (2026-06-17)

Revised per the reframed unified editorial model (editorial model redesign, 2026-06-17). Committed as
`d1ac67a` (implement: unified-channel-model-editorial-engine-topology).

**What changed:**
- `PlayoutEditorialTier` union drops `pool` variant; `queue` now carries `poolScope: PoolScope` so the
  render can build the pool feed without a second DB call. `PoolScope` defined locally in
  `playout-topology.ts` (not imported from `editorial-config.ts`) to preserve the pure no-DB module
  boundary — `editorial-config.ts` has a top-level DB import that would break the topology unit tests.
- `PlayoutChannelRow` gains `ownership` + `creatorId` fields; pool scope resolved inline.
- `buildPlayoutTopology` filters disabled tiers before resolution.
- `resolveEditorialTier`: unknown channel-as-source reference now drops the carry tier + warns
  (finding 6 fix) instead of throwing.
- `ValidationError` used everywhere plain `Error` was thrown (finding 5 fix).
- topoSort receives edge list built directly in `buildPlayoutTopology` from the config at resolution
  time — no string-strip reverse-map of `sourceLiqVar` (finding 4 fix). Unknown-source carry edges
  excluded from edge list (dropped at resolution) so Kahn's queue never blocks on a phantom dependency.
- `harborChannelPaths` drops `priority`, adds `manual`.
- `liquidsoap-config.ts` selects `ownership` + `creatorId` columns from the channels table.

**Tests (Story A):** 1711 tests pass (112 test files). Topology test suite updated: new harborChannelPaths
shape, queue-carries-poolScope, disabled-tier exclusion, degenerate all-disabled fallback, topo sort with
disabled-carry edge exclusion, unknown-sourceId drops (not throws).

**Findings fixed:** 4 (edge-list direct pass), 5 (ValidationError), 6 (graceful carry drop).

## Review of revision (2026-06-17)

**Verdict**: Approve. No blockers; advanced `review → done` (reviewed as a bundle with the render).

Union/poolScope/edge-list-refactor/typed-errors correct; findings 4–6 resolved. Validated jointly with
the render — the rendered `.liq` typechecks on real Liquidsoap 2.4.2 (`liquidsoap --check`, exit 0; see the
render story).

**Nit (filed → `editorial-render-followups`)**: `PoolScope` is now defined in two places
(`editorial-config.ts` and `playout-topology.ts`) — a small SSOT dup; the clean home is `@snc/shared`
(no DB), imported by both. The worker's local redefinition was to keep `playout-topology.ts` DB-free,
which is the right constraint — just solve it via shared rather than duplication.

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
