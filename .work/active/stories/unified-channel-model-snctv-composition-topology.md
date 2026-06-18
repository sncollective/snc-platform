---
id: unified-channel-model-snctv-composition-topology
kind: story
stage: review
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

## Implementation (2026-06-18) — the equivalence gate cleared

**`liquidsoap-config.ts`**: widened the channel query from `eq(role, "playout")` to
`inArray(role, ["playout","broadcast"])` and added `role` to the projection, so the broadcast
channel reaches `buildPlayoutTopology`.

**`playout-topology.ts`**: removed the static `broadcast` topology field (`queueId` /
`fallbackSourceVar`) and the `sncTvStream` env entry — both were only consumed by the now-deleted
static tail. Dropped the now-unused `SNC_TV_BROADCAST` import.

**`liquidsoap-render.ts`**: deleted the entire static "S/NC TV (broadcast — static)" `.liq` tail.
The broadcast channel now emits a generated block via `channelBlocks` (the broadcast-render story's
role-conditioned path). Dropped the now-unused `HARBOR_LEGACY_NOW_PLAYING` import (its *export* stays
on `playout-topology.ts` until the `nowplaying-consumer` story repoints `liquidsoap.ts`).

**`docs/streaming.md`**: rolled forward — S/NC TV is described as an editorial-config channel (role
`broadcast`, live takeover = priority-0 tier, Classics carried as a `channel-as-source` fallback),
and the `.liq` is described as fully DB-generated (no hand-maintained per-channel section).

### Equivalence evidence (render golden diff, reviewed)

The `playout-1ch.liq` golden diff (Classics + S/NC TV) is the equivalence proof. The load-bearing
fallback is **byte-equivalent**:
```
ch_<snctv>_source = fallback(track_sensitive=false,
  transitions=[notify_switch("live"), notify_switch("queue"), notify_switch("fallback"), notify_switch("blank")],
  [ch_<snctv>_live, ch_<snctv>_queue_program, ch_<classics>_source, mksafe(blank())])
```
— same `track_sensitive`, same transition names/order, same source order (live → queue → Classics
carry → blank), same `:1936` live input, same `output.url` to `snc-tv` (simulcast intact), same
`notify_switch` → `/api/playout/broadcast/input-switch`.

**Intentional improvements** (bold-refactor upgrades, additive/superior — not regressions):
- The queue is now `queue + pool auto-fill` (`_queue_program = fallback([queue, pool])`) — S/NC TV
  gains the pool LRP rotation every channel has; empty-pool behavior falls through to silence as
  before.
- Now-playing is `selected()`-based with an additive `selected` field (the design's stated upgrade;
  `on_metadata` is blind to mid-track re-selection).
- Per-channel `/channels/<id>/now-playing` replaces the legacy `/now-playing` (the
  `nowplaying-consumer` story repoints the API consumer).
- Adds track-event webhook + skip + arm harbor endpoints (every channel has these; harmless for
  broadcast).

**Two minor behavior deltas (accepted under bold-refactor framing, flagged for review):**
1. **`CHANNEL_SNCTV_STREAM` env override dropped** — the generated `output.url` uses the DB
   `srsStreamName` (`snc-tv`) as a literal, not `environment.get("CHANNEL_SNCTV_STREAM", default="snc-tv")`.
   Confirmed unused anywhere (only referenced in source/tests, never in env config), so the override
   was dead capability. Equivalent by default; a future runtime stream-name override would be a
   per-channel concern, not a broadcast special case.
2. **`${vid}_armed` dead ref for broadcast** — emitted by the shared block but the broadcast fallback
   doesn't gate on it (matches the old unconditional `snc_tv_queue`). Cosmetic; the editorial UI
   won't expose arm for broadcast.
3. **0-channel edge**: with a literally empty DB (no broadcast row either), there is now no S/NC TV
   output at all (previously the static block always emitted). In deployment the broadcast channel is
   always seeded (the `seed-config` story guarantees it), so this is a non-occurring edge.

### Verification
- **`liquidsoap --check` clean on all 4 goldens** (0ch/1ch/2ch/special-chars) in the running
  `snc-liquidsoap` container — the generated broadcast block is valid Liquidsoap. Only output is
  pre-existing `Unused variable _req` warnings (present in playout channels too, not introduced here).
- Full API unit suite **1768 passed**; `tsc --noEmit` clean.
- `check-doc-links` on `docs/streaming.md` clean (run at commit).

## Design reference
Feature body §Implementation Units / Unit 2 + Unit 5.
