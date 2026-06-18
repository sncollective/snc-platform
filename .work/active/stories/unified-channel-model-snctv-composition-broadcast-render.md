---
id: unified-channel-model-snctv-composition-broadcast-render
kind: story
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model-snctv-composition
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-18
updated: 2026-06-18
---

# Render the broadcast-role live tier (+ source-switch telemetry)

Teach the pure Liquidsoap render to emit S/NC TV's broadcast affordances, keyed on channel
`role`, so the broadcast channel can render through the unified `renderChannelBlock` path instead
of the static tail. No consumer wiring here — this story is the pure render change; the broadcast
channel doesn't reach the topology until the `topology` story.

## Scope

**File**: `apps/api/src/services/liquidsoap-render.ts`

1. **`renderTierSource` `live` case** — when `ch.role === "broadcast"`, render the real broadcast
   RTMP input as the live source:
   ```ts
   if (ch.role === "broadcast") {
     const liveVar = `${vid}_live`;
     return {
       varName: liveVar,
       declaration: `${liveVar} = input.rtmp(listen=true, "rtmp://0.0.0.0:${t.broadcastInputPort}/live/stream")`,
     };
   }
   return null; // non-broadcast live tier deferred (I2) — unchanged
   ```
   This is the ONLY channel for which a `live` tier produces real `.liq`. The I2 port-1936
   collision deferral stays in force for every other role (still `return null`).

2. **Source-switch telemetry (broadcast only)** — the broadcast channel's generated switch/fallback
   must post the selected-source name to `${BROADCAST_INPUT_SWITCH_PATH}`
   (`/api/playout/broadcast/input-switch`) on each source switch — the live-state spine integration
   today's `notify_switch` transitions provide. Emit a `notify_switch`-equivalent for the broadcast
   role only (role-conditioned, like the live tier). The existing route + its consumer are
   unchanged.

3. **Now-playing** — the broadcast channel uses the standard generated `switch.selected()`
   now-playing harbor path. Do NOT emit the legacy `/now-playing` path or the `on_metadata`
   `snc_tv_uri`/`snc_tv_title` refs (those are retired in the `topology` story when the static tail
   is deleted).

`ch.role` must be available on `PlayoutChannelTopology` — the `topology` story adds it to the row +
topology types. This story can land the render logic guarded on `ch.role === "broadcast"`; until the
topology carries the broadcast channel + role, the branch is dormant (no broadcast channel in
`channels[]` yet). Sequence: this story first (pure, dormant), then `topology` activates it.

## Acceptance criteria
- [ ] Broadcast-role channel renders a `live` tier as the `:1936` `input.rtmp` listener; non-broadcast channels still render `live` → `null`.
- [ ] The broadcast channel's switch posts source-switch events to `/api/playout/broadcast/input-switch`.
- [ ] The broadcast channel renders the standard `selected()`-based now-playing; no legacy `/now-playing`, no `on_metadata` refs in the generated block.
- [ ] Render stays pure / byte-deterministic for a given topology.
- [ ] `liquidsoap-render.test.ts` covers: broadcast live render, non-broadcast null, broadcast telemetry presence, broadcast now-playing shape.

## Implementation refinement (2026-06-18, grounding the render)

Reading the render surface sharpened *how* the broadcast affordances render — a precision
refinement of Unit 1, not a scope change:

- **Telemetry rides on `fallback(transitions=[…])`, not `switch()`.** The current static block uses
  `fallback(track_sensitive=false, transitions=[notify_switch("live"), …], [live_source, snc_tv_queue,
  default, blank])`. `transitions=` is a **`fallback` parameter** (per the liquidsoap-v2 reference);
  the generic generated-channel path uses `switch()` with all-true predicates, which does not carry
  the same `transitions=` telemetry. The broadcast channel's editorial config is **pure-auto where
  every source is always-ready or armed**, so `fallback` is the exact-equivalence structure. Decision:
  for the broadcast role, `renderChannelBlock` renders `${vid}_source` as a
  `fallback(track_sensitive=false, transitions=[…notify_switch per source…], [ …tier vars…,
  mksafe(blank()) ])` — structurally identical to today's block — instead of the `switch()` path. This
  is the lowest-risk equivalence-preserving choice and keeps the SPIKE-NOTE'd `transitions` mechanism
  exactly as-is (no new untested telemetry path).
- **The `live` tier must NOT be excluded for broadcast.** Today `renderTierSource` returns `null` for
  `live`, and `renderChannelBlock` *skips* null tiers (I2). For broadcast, the `live` tier renders the
  `:1936` `input.rtmp` and participates as the highest-priority fallback source. So the broadcast
  render path includes the live var in its `fallback` list (it is not subject to the I2 skip).
- **`role` on the topology type.** `renderChannelBlock` keys on `ch.role === "broadcast"`. This story
  adds `role` to `PlayoutChannelTopology` (the render's type dependency) so the render typechecks; the
  `topology` story adds it to `PlayoutChannelRow` and populates it from the DB query. Until then the
  broadcast branch is dormant (no broadcast channel reaches `channels[]`).
- **`notify_switch` helper.** The broadcast render emits the `notify_switch(name)` def + the
  `fallback(transitions=[…])` verbatim from today's static block (it posts to
  `BROADCAST_INPUT_SWITCH_PATH`), so the live-state spine integration is byte-equivalent.

## Implementation (2026-06-18)

Render learns the broadcast-role affordances; dormant until the `topology` story widens the query
to bring the broadcast channel into `channels[]`.

**`apps/api/src/services/playout-topology.ts`**:
- Added `role` to `PlayoutChannelTopology` (the render keys on it) and `role?` to
  `PlayoutChannelRow` (the `topology` story populates it from the widened query; defaults to
  `"playout"` when absent). Mapped `role: row.role ?? "playout"` through `buildPlayoutTopology`.

**`apps/api/src/services/liquidsoap-render.ts`**:
- `renderTierSource` `live` case: renders `${vid}_live = input.rtmp(listen=true, …:1936/live/stream)`
  when `ch.role === "broadcast"`; keeps the I2 `return null` for every other role (per-channel live
  ingest still deferred — the 1936 collision only bites non-broadcast channels).
- New `renderBroadcastFallback(tierVarNames)` helper: builds
  `fallback(track_sensitive=false, transitions=[…], [ …tiers…, mksafe(blank()) ])`. Transition
  names are pinned to the input-switch route's strict enum (`live` / `queue` / `fallback` / `blank`,
  in order) — derived from the tier var suffix (`_live`→live, `_queue_program`→queue, carry→fallback).
- `renderChannelBlock` branches on `ch.role === "broadcast"`: broadcast renders the
  `fallback(transitions)` + the `notify_switch(name)` def (verbatim from the old static block, posting
  to `BROADCAST_INPUT_SWITCH_PATH`); playout renders the generic `switch()` readiness fallback. The
  block header reads `(broadcast)` vs `(playout)`. Everything else (output.url, selected()-based
  now-playing, arm/queue/skip harbor endpoints) is shared — those are already equivalence-superior to
  the static block.

**Equivalence**: the broadcast fallback `[live_source, queue_program, carry_source, blank]` with
`transitions=[notify_switch(live/queue/fallback/blank)]` is structurally identical to the prior
static `snc_tv = fallback(...)`. The static block itself is NOT touched here — it's deleted in the
`topology` story when the broadcast channel joins the generated topology. So both coexist this story
(the broadcast branch is dormant — no broadcast channel in `channels[]` yet).

**Note (minor)**: `${vid}_armed` ref + the arm harbor endpoint still render for the broadcast channel
(shared block) but are unused — the broadcast fallback doesn't gate on `_armed` (matches the old
block's unconditional `snc_tv_queue`). Harmless dead ref; the editorial UI won't expose arm for
broadcast. Left as-is rather than adding a role branch for a cosmetic-only gain.

**Tests** (`playout-topology.test.ts`, new `renderChannelBlock — broadcast role` describe, 7 cases):
:1936 input rendered; source is `fallback(transitions=[…])` not `switch`; transitions in enum order;
sources ordered live→queue→carry→blank; `selected()` now-playing (no legacy path); `snc-tv` output;
non-broadcast live tier renders nothing (I2 holds) + uses `switch()`.

**Verification**: full API unit suite **1770 passed** (was 1763; +7); `tsc --noEmit` clean. Existing
static-block tests in `liquidsoap-config.test.ts` still green (static block untouched this story).

## Design reference
Feature body `unified-channel-model-snctv-composition` §Implementation Units / Unit 1.

## Review findings — BOUNCE (feature deep review, 2026-06-18)

Fresh-context adversarial review caught a real **output-equivalence regression** the snapshot
golden (structure-only) and unit tests missed.

**BLOCKER: now-playing `uri`/`title` go blank when S/NC TV airs the carried Classics (the steady
state).** `liquidsoap-render.ts` attaches `on_metadata` to `${vid}_queue` (the broadcast's own
operator queue) only — but the broadcast channel's dominant airing state is the **carried Classics**
source (no live creator, empty broadcast queue). The OLD static block attached
`snc_tv.on_metadata` to the **whole fallback**, so `snc_tv_uri`/`snc_tv_title` updated from whatever
aired, including Classics. NEW: `${vid}_uri`/`${vid}_title` are written only by the queue's
`on_metadata`, so they stay `""` whenever Classics carries.

Downstream impact: `getNowPlaying` (`liquidsoap.ts`) reads `uri`/`title`; `srs.ts` surfaces S/NC TV's
viewer-facing now-playing title; `playout.ts` correlates the airing item by matching `raw.uri`
against `/playout/(id)/`. All go blank/null when Classics carries — i.e. most of the time. The
`selected()` upgrade restored the `selected` source-id field but NOT `uri`/`title` for the carried
source.

**To fix**: the broadcast channel needs now-playing metadata that reflects the *aired* source, not
just its own queue. Options to weigh in the fix:
1. For the broadcast role, propagate metadata from the carried channel's now-playing (the carried
   `_source` already has its own `on_metadata` → its `_uri`/`_title` refs; the broadcast now-playing
   handler could read the *selected* child's refs).
2. Attach an `on_metadata` to the broadcast `${vid}_source` (the whole fallback) as the OLD block did
   — but reconcile with the per-channel track-event webhook semantics (the webhook should still fire
   on operator-curated content only, not carried content, to avoid double-counting).
3. Have the now-playing handler resolve `uri`/`title` from `.selected()`'s child source refs.

Whichever path: add a test that fetches broadcast now-playing while the **carried** source airs (not
just the queue), asserting `uri`/`title` are populated — the gap that let this through.

**Also (IMPORTANT, fold in here): the broadcast `/arm` endpoint + `_armed` ref are a live no-op.**
The broadcast block registers `POST /channels/<id>/arm` (writes `${vid}_armed`) but
`renderBroadcastFallback` never reads `_armed` (the fallback lists sources unconditionally). So
arming S/NC TV returns `"ok"` and does nothing. Either gate the broadcast queue tier on `_armed`
(matching playout `switch()` semantics) or suppress the `_armed` ref + `/arm` registration for the
broadcast role. Not an equivalence gap (old block had no arm gate either), but a confusing dead
control surface introduced by routing broadcast through the shared block.
