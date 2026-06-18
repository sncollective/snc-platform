---
id: unified-channel-model-snctv-composition-topology
kind: story
stage: implementing
tags: [streaming, playout, documentation]
parent: unified-channel-model-snctv-composition
depends_on: [unified-channel-model-snctv-composition-broadcast-render]
release_binding: null
gate_origin: null
created: 2026-06-18
updated: 2026-06-18
---

# Bring the broadcast channel into the topology; delete the static block

**The equivalence gate.** S/NC TV stops being a separate static render path and becomes a generated
channel block. This is where output-equivalence is demonstrated (render golden diff reviewed here).

## Scope

**Files**: `apps/api/src/services/playout-topology.ts`, `apps/api/src/services/liquidsoap-config.ts`,
`apps/api/src/services/liquidsoap-render.ts` (static-tail deletion), `docs/streaming.md`

1. **Widen the channel query** in `generateLiquidsoapConfig` from `role = "playout"` to include the
   broadcast role (`role IN ("playout","broadcast")`), so the broadcast channel row reaches
   `buildPlayoutTopology`.

2. **Add `role` to the topology types** — `PlayoutChannelRow` (query projection) and
   `PlayoutChannelTopology` (the render keys on it, per the `broadcast-render` story).

3. **Topo-sort places the broadcast channel after Classics** — already guaranteed by the existing
   carry-edge topo-sort once the broadcast channel carries a `channel-as-source` tier to Classics
   (seeded in the `seed-config` story). Confirm the broadcast block's `output.url`/source references
   resolve after Classics' `_source`.

4. **Delete the static `broadcast` topology field** (`broadcast: { queueId, fallbackSourceVar }`)
   and the static `.liq` tail in `renderPlayoutLiq` (§"S/NC TV (broadcast — static)"). The broadcast
   channel now emits a normal generated block. `broadcastInputPort` stays on the topology (the
   Unit-1 live render reads it), but its consumer moves from the static tail into the generated
   render.

5. **Verify the generated `output.url` targets the `snc-tv` stream** — simulcast `on_forward` keys
   on this stream name. The generated block's `output.url` uses the channel's `srsStreamName`
   (`"snc-tv"` for the broadcast channel), so it falls out correctly — but assert it (a mismatch
   silently breaks simulcast).

6. **Roll `docs/streaming.md` forward** — describe S/NC TV as an ordinary editorial-config channel
   (auto, 3 tiers, takeover = priority-0 live tier), not a Liquidsoap special case. Rolling-foundation
   is a hard rule; the drift lands with this change, not after.

## Acceptance criteria
- [ ] The broadcast channel appears in `topology.channels` with `role: "broadcast"`; the static `broadcast` field + static `.liq` tail are removed.
- [ ] Generated broadcast block's `output.url` targets the `snc-tv` stream (simulcast path intact) — asserted in a test.
- [ ] Topo-sort emits Classics' `_source` before the broadcast block references it.
- [ ] **Render golden (the equivalence evidence)**: the generated broadcast block is behaviorally equivalent to the prior static tail — diff captured + reviewed in this story body. `playout-topology.test.ts` + `liquidsoap-config.test.ts` goldens updated.
- [ ] `docs/streaming.md` rolled forward (no stale special-case description).
- [ ] `tsc --noEmit` clean; `liquidsoap --check` clean on the generated config.

## Design reference
Feature body §Implementation Units / Unit 2 + Unit 5.
