---
id: bold-channel-topology-model-render
kind: feature
stage: review
tags: [refactor, streaming, playout]
release_binding: null
depends_on: [refactor-playout-stream-names-dedup]
gate_origin: null
created: 2026-06-12
updated: 2026-06-13
parent: bold-channel-topology
---

# Topology module + pure render of playout.liq

## Brief
Introduce a typed topology module that assembles the full playout/streaming topology
(channels with UUIDs and `srsStreamName`s, harbor/RTMP/API ports, callback URLs, secret
references) from DB channel state + env config, and replace the string-builder in
`apps/api/src/services/liquidsoap-config.ts` (~307 LOC) with a pure render function over
that topology. The rendered `.liq` must be byte-identical (or provably equivalent) to
today's output for the same inputs — golden-file tests against the current generator are
the verification spine. `regenerateAndRestart()` keeps its current semantics in this
feature; only the source of the rendered text changes.

Behavior-preserving: same `.liq` out, same restart signal, no caller-visible change.

Depends on `refactor-playout-stream-names-dedup` (in-flight) because the topology module
becomes the natural owner of stream-name constants — let that extraction land first and
build on its placement.

This is the riskiest child: if the topology model can't cleanly express what the string
builder does (per-channel queue/source variable naming, fallback wiring, harbor handlers),
the epic's premise fails. Design this first via /agile-workflow:refactor-design.

## Refactor Overview

Designed 2026-06-13 (refactor-design, per-feature mode; direct scan — bounded module, no
Explore needed). Key problems found:

- `generateLiquidsoapConfig` (liquidsoap-config.ts:107-218) fuses three concerns: DB query,
  fallback-selection policy, and a ~110-line template literal. Topology facts — ports
  8888/1935/1936, queue-id schemes (`channel-<uuid>`, `snc-tv-queue`), the `ch_<uuid>`
  variable-naming scheme, callback URL shapes — exist only as embedded string fragments.
- Ports & Adapters drift: the render logic is welded to the DB, so tests mock a Drizzle
  chain to test string output, and the sibling features (startup-assertions,
  drift-detection) have no typed value to validate against.
- Live string-matching contract: harbor paths `/channels/{id}/queue|skip|now-playing` are
  built independently on the registration side (the template) and the caller side
  (`liquidsoap-client.ts:71-85`, legacy `/now-playing` in `liquidsoap.ts:19`).
- Dead weight: none — all five exports have live consumers.

Plan: four steps, characterization-first. Goldens pin the current output byte-for-byte
before anything moves; the swap is reviewable purely as "snapshot files unchanged."

## Design decisions

- **Three-module split**: `playout-topology.ts` (types + pure `buildPlayoutTopology`),
  `liquidsoap-render.ts` (pure `renderPlayoutLiq`), `liquidsoap-config.ts` keeps IO
  (path resolution, write, restart signal, health) with its public surface unchanged.
  Rejected: render inside the topology module — drift-detection wants to hash render
  output independently, and the unified-channel-model epic re-shapes the model without
  touching the render seam.
- **Env values stay references**: `.liq`-runtime values (`PLAYOUT_STREAM_KEY`, `SRS_RTMP_HOST`,
  `CHANNEL_SNCTV_STREAM`, …) are modeled as `EnvRef { envVar, default }` and rendered as
  `environment.get(...)` — never resolved at render time. Resolving them would silently
  change behavior under container env.
- **`broadcast.queueId` is its own datum**, not derived from the stream name: the env var
  can override the stream name at .liq runtime, but the queue id is baked at render time —
  a derivation would assert a coupling that doesn't exist.
- **`SNC_TV_BROADCAST` stays in `services/channels.ts`** (landed by
  refactor-playout-stream-names-dedup); topology imports it. Ownership moves only when
  unified-channel-model re-shapes the seam.
- **Goldens via Vitest `toMatchFileSnapshot`** with committed `.liq` files (readable,
  diffable in review) rather than inline snapshots. Output is env-independent (no
  render-time config interpolation), so the snapshots are stable across machines.
- **Strictly no unification semantics** (per the parent epic's enabler note) — channel =
  receiver modeling, editorial surfaces, identity/state splits all stay out.

## Refactor Steps

Full step bodies (current/target/notes/acceptance/risk/rollback) live in the child
stories; summary:

### Step 1: Golden characterization tests — `bold-channel-topology-model-render-step-1`
**Priority**: High · **Risk**: Low · **Source Lens**: missing verification spine
Four `toMatchFileSnapshot` goldens (0 / 1 / 2 channels, special-char name) captured from
the current generator before anything moves.

### Step 2: Typed topology module — `bold-channel-topology-model-render-step-2`
**Priority**: High · **Risk**: Low · **Source Lens**: missing abstraction / pattern drift (SSOT)
`playout-topology.ts`: `PlayoutTopology` types + pure `buildPlayoutTopology(rows)`.
Additive — no consumers yet; direct unit tests with no mocks.

### Step 3: Pure render + rewire — `bold-channel-topology-model-render-step-3`
**Priority**: High · **Risk**: Medium (production streaming path; fully pinned by goldens)
**Source Lens**: code smell (god function) / pattern drift (Ports & Adapters)
`liquidsoap-render.ts`: `renderPlayoutLiq(topology)`; `generateLiquidsoapConfig` becomes
query → build → render. Public surface unchanged. Review bar: zero golden diff.

### Step 4: Shared harbor path builders — `bold-channel-topology-model-render-step-4`
**Priority**: Medium · **Risk**: Low · **Source Lens**: missing abstraction (string contract)
`liquidsoap-client.ts` / `liquidsoap.ts` import path builders from the topology module.
⚠ Coordinate with the lifecycle-transitions playout-queue work (same module family)
before starting; deliberately last and independently droppable.

## Implementation Order
1. `bold-channel-topology-model-render-step-1` (goldens)
2. `bold-channel-topology-model-render-step-2` (topology module)
3. `bold-channel-topology-model-render-step-3` (the swap)
4. `bold-channel-topology-model-render-step-4` (path builders — after lane coordination)

No atomic/irreversible steps: no public API, schema, or contract changes anywhere in the
chain; every step is a clean `git revert`.

## Review

All four steps implemented and committed 2026-06-13 (goldens ce1528e, topology b33573f, swap 13dbbd5, path builders 6b70d41). Feature-level fresh-context adversarial review: **APPROVE.** Byte-identity verified three ways — slot-by-slot escape analysis old-vs-new for arbitrary inputs (both escape exactly name/srsStreamName/snc-tv default, both emit ids verbatim), the goldens re-validated against the OLD generator in a throwaway worktree (4/4 byte-exact), and zero snapshot diff since capture. No import cycles (DAG: client/render → topology → channels → db). Suite 511/511 in tests/services, typecheck green. One accepted nit fixed post-review: the "imports no DB code" comment in playout-topology.ts overstated purity (transitive db reach via channels.ts) — reworded.

Awaiting user review-pass + release pick per `.work/CONVENTIONS.md` §Release-binding lifecycle (applies to the four child stories too).
