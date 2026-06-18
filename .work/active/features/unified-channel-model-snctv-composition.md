---
id: unified-channel-model-snctv-composition
kind: feature
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model
depends_on: [unified-channel-model-editorial-engine]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-18
---

# S/NC TV as composition — takeover becomes programming

## Brief
Re-express S/NC TV's hardcoded editorial priority as channel-as-source programming on the
editorial engine: today's `fallback([live_source, snc_tv_queue, defaultPlayoutSource,
blank()])` becomes an ordinary editorial config — live creator carry (channel-as-source),
own queue, pool fallback — making the creator takeover a visible, editable programming
decision instead of plumbing. This is the epic's "line 192 becomes the rule" moment and
the engine's first real consumer.

The review bar is **output-equivalence**: same airing behavior as today's fallback
semantics for the same inputs (live creator preempts, queue next, default playout pool,
silence last; takeover and fall-back transitions behave identically from the viewer's
seat). Where the engine's mechanism makes exact `.liq`-level byte-identity impossible
(this is a behavior-bearing epic, not a refactor), equivalence is demonstrated
behaviorally — the design pass defines the equivalence checks (likely: rendered-config
review + the live-fallback test script `scripts/dev/test-live-fallback.sh` + staged
manual verification per platform's fix-verify discipline).

Does NOT cover: changes to simulcast semantics (simulcast stays on the S/NC TV output —
whatever S/NC TV airs is what forwards); creator-side editorial (sibling
`creator-enablement`); new viewer UI (takeover visibility indicators are
`live-experience-redesign-live-state`'s).

## Epic context
- Parent epic: `unified-channel-model`
- Position in epic: first composition consumer of `editorial-engine`; the validation gate
  that the unified model actually expresses what the special case did.

## Foundation references
- `docs/streaming.md` — S/NC TV fallback chain, simulcast-on-playout-output
- Epic body `## Decisions` — carry model (channel-as-source), rejected alternatives

## Design decisions (user, 2026-06-18)

Grounded against the **landed** editorial engine (shipped in 0.4.0) — not the brief's
pre-engine assumptions. The engine's `## Architectural choice` already names this feature:
"`snctv-composition` migrates [the static block] later; S/NC TV is just an always-exists admin
channel under this model." So most of the model is settled by construction; these are the
remaining forks the user resolved.

- **Live takeover semantics: a non-issue (already general).** The engine's **auto mode = readiness
  fallback over enabled sources** (`switch(track_sensitive=false, [ …sources in priority order…,
  ({true}, mksafe(blank())) ])`, all-true predicates, highest-priority *ready* source wins). That
  IS S/NC TV's `fallback([live_source, snc_tv_queue, default, blank])` — the generalization was
  explicitly designed as "the line-192 generalization, self-running" (unified redesign, 2026-06-17).
  No arm-gate dilemma: arm/take gates only the *queue* tier's participation, orthogonal to live
  takeover.

- **Live input: Option A — the `live` tier renders the port-1936 input, for the broadcast role
  only.** S/NC TV gets a real 3-tier config `[live(p0) → queue(p1) → channel-as-source→Classics(p2)]`.
  The `live` tier type currently renders to `null` for ALL channels (I2: per-channel `input.rtmp`
  on `:1936` collides — every channel can't bind the same listener). But S/NC TV is the **one**
  channel that legitimately owns `:1936` — the single broadcast input every creator pushes to. So
  the `live` render becomes role-conditioned: `input.rtmp(listen=true, …:1936/live/stream)` for the
  broadcast role, `null` (deferred, unchanged) for every other channel. This delivers the brief's
  thesis fully — the live takeover becomes a visible, reorderable editorial tier, not plumbing.
  *Rejected (Option B): keep `live_source` as a render constant prepended to the switch — lower
  equivalence risk, but the takeover stays infrastructure and S/NC TV is never truly "just a
  channel"; leaves a permanent asterisk on the unified model. Bold-refactor framing (below) tilts
  to A.*

- **Bold-refactor framing: discard the legacy broadcast I/O block, design from scratch.** The user
  authorized treating this as a bold-refactor — no obligation to preserve the current static block's
  affordances. Consequence: S/NC TV renders entirely through the **unified** `renderChannelBlock`
  path, and the legacy broadcast-only affordances are **replaced**, not preserved:
  - **Legacy `/now-playing` harbor endpoint** (`HARBOR_LEGACY_NOW_PLAYING`, consumed by
    `liquidsoap.ts:20`) → **discarded**. The generated path's `switch.selected()`-based now-playing
    is strictly better (the spike proved `on_metadata` is blind to mid-track re-selection). The
    consumer `liquidsoap.ts` is updated to read the broadcast channel's **per-channel** now-playing
    path.
  - **`on_metadata` broadcast refs** (`snc_tv_uri`/`snc_tv_title`) → **discarded**, superseded by the
    generated per-channel now-playing.
  - **`notify_switch` source-switch telemetry** → **regenerated, not preserved verbatim.** This is
    the live-state event-spine integration (which source is airing → posted to the live-state
    holder), and it IS load-bearing. But it is not broadcast-special in principle — any channel's
    source switch is a live-state event. The generated render emits source-switch telemetry for the
    broadcast channel (role-conditioned, like the live tier), posting to the existing
    `/api/playout/broadcast/input-switch` route. The route + its consumer are unchanged.

- **Verification: rendered-config golden + live-fallback + staged walk** (user-chosen). Three
  layers, matching how the editorial engine itself was verified: (1) a render golden asserting the
  generated S/NC TV `.liq` is behaviorally equivalent to today's static block (diff reviewed in the
  story), (2) `scripts/dev/test-live-fallback.sh` against the live LS pipeline, (3) a staged manual
  takeover/fall-back walk per platform's fix-verify loopback (viewer + simulcast confirmed).

## Architectural choice

**Bring the broadcast channel into the generated topology, render it through the unified
`renderChannelBlock` path with two role-conditioned affordances (live-input render + source-switch
telemetry), seed its 3-tier editorial config to be output-equivalent, then delete the static block
and the `broadcast` topology field.**

Today the broadcast channel (`role: "broadcast"`, `srsStreamName: "snc-tv"`) is **invisible to the
topology builder**: `generateLiquidsoapConfig` filters channel rows to `role: "playout"`
(`liquidsoap-config.ts`), so `buildPlayoutTopology` never sees S/NC TV. The channel is rendered
entirely from the static `broadcast` topology field + the static `.liq` template tail
(`liquidsoap-render.ts` §"S/NC TV (broadcast — static)"). This feature dissolves that special path:
the broadcast channel joins `channels[]`, gets a generated block like any other, and the static
tail is removed.

Output-equivalence is achievable by construction because the engine's auto-mode readiness fallback
already reproduces the broadcast fallback semantics; the only behavioral gaps are the two
role-conditioned affordances (live input, switch telemetry), which the render learns to emit for
the broadcast role.

## Implementation Units

### Unit 1: Render the `live` tier for the broadcast role (+ source-switch telemetry)
**File**: `apps/api/src/services/liquidsoap-render.ts`
**Story**: `unified-channel-model-snctv-composition-broadcast-render`

Teach the pure render to emit broadcast affordances, keyed on channel role (the topology must carry
`role` — see Unit 2).

- **`renderTierSource` `live` case**: when `ch.role === "broadcast"`, return
  `{ varName: "${vid}_live", declaration: '${vid}_live = input.rtmp(listen=true, "rtmp://0.0.0.0:${t.broadcastInputPort}/live/stream")' }`.
  For every other role, keep the current `return null` (I2 deferral unchanged). This is the only
  channel for which a `live` tier produces real `.liq`.
- **Source-switch telemetry**: the broadcast channel's generated `switch`/`fallback` must post the
  selected-source name to `${BROADCAST_INPUT_SWITCH_PATH}` (`/api/playout/broadcast/input-switch`)
  on each switch — the live-state spine integration that today's `notify_switch` transitions
  provide. Emit a `notify_switch`-equivalent for the broadcast channel only (role-conditioned).
  The existing route + consumer are unchanged.
- **Now-playing**: the broadcast channel uses the standard generated `switch.selected()` now-playing
  harbor path (no legacy `/now-playing`, no `on_metadata` refs).

```ts
// renderTierSource, case "live":
if (ch.role === "broadcast") {
  const liveVar = `${vid}_live`;
  return {
    varName: liveVar,
    declaration: `${liveVar} = input.rtmp(listen=true, "rtmp://0.0.0.0:${t.broadcastInputPort}/live/stream")`,
  };
}
return null; // non-broadcast live tier deferred (I2) — unchanged
```

**Acceptance criteria**:
- [ ] Broadcast-role channel renders a `live` tier as the `:1936` `input.rtmp` listener; non-broadcast channels still render `live` → `null`.
- [ ] The broadcast channel's switch posts source-switch events to `/api/playout/broadcast/input-switch` (telemetry preserved).
- [ ] The broadcast channel renders the standard `selected()`-based now-playing; no legacy `/now-playing`, no `on_metadata` refs in the generated block.
- [ ] Render is pure / byte-deterministic for a given topology (existing invariant holds).

### Unit 2: Bring the broadcast channel into the topology
**File**: `apps/api/src/services/playout-topology.ts`, `apps/api/src/services/liquidsoap-config.ts`
**Story**: `unified-channel-model-snctv-composition-topology`
**depends_on**: `[unified-channel-model-snctv-composition-broadcast-render]`

- Widen the channel query in `generateLiquidsoapConfig` from `role = "playout"` to include the
  broadcast role (`role IN ("playout","broadcast")`), so the broadcast channel row reaches
  `buildPlayoutTopology`.
- Add `role` to `PlayoutChannelRow` / `PlayoutChannelTopology` (the render keys on it in Unit 1).
- Ensure topo-sort places the broadcast channel **after** its `channel-as-source` target (Classics)
  — the existing carry-edge topo-sort already guarantees this once the broadcast channel carries a
  channel-as-source tier to Classics.
- **Delete the static `broadcast` topology field** (`broadcast: { queueId, fallbackSourceVar }`) and
  the static `.liq` tail in `renderPlayoutLiq`. The broadcast channel now emits a normal generated
  block. Remove `broadcastInputPort` from the static tail's use — it moves into the Unit-1 live
  render (still sourced from the topology).
- The broadcast channel keeps `output.url` to its `snc-tv` SRS stream — this falls out of the
  generated block's `output.url` using the channel's `srsStreamName` (`"snc-tv"`), so simulcast
  (which sits on that output) is unaffected. Verify the generated `output.url` matches the stream
  name the simulcast `on_forward` expects.

**Acceptance criteria**:
- [ ] The broadcast channel appears in `topology.channels` with `role: "broadcast"`; the static `broadcast` field and static `.liq` tail are gone.
- [ ] Generated broadcast block's `output.url` targets the `snc-tv` stream (simulcast path intact).
- [ ] Topo-sort emits Classics' `_source` before the broadcast block references it.
- [ ] `playout-topology.test.ts` golden updated; render is behavior-equivalent to the prior static tail (diff reviewed in the story body — the equivalence gate).

### Unit 3: Seed S/NC TV's editorial config (the 3 tiers)
**File**: `apps/api/src/scripts/seed-channels.ts` (+ `editorial-config` service calls)
**Story**: `unified-channel-model-snctv-composition-seed-config`
**depends_on**: `[unified-channel-model-snctv-composition-topology]`

After `ensureBroadcast`, idempotently upsert the broadcast channel's editorial config + tiers so the
generated block reproduces the old fallback order:
- `upsertEditorialConfig(broadcastId, { mode: "auto" })`
- `createEditorialTier(broadcastId, { tierType: "live", priority: 0 })`
- `createEditorialTier(broadcastId, { tierType: "queue", priority: 1 })`
- `createEditorialTier(broadcastId, { tierType: "channel-as-source", priority: 2, sourceChannelId: <classicsId> })`

Idempotency: seed must be safe to re-run (the engine's `createEditorialTier` + `upsertEditorialConfig`
already exist; guard against duplicate tiers on re-seed — check existing tiers first, or make the
seed clear-and-recreate the broadcast config).

**Acceptance criteria**:
- [ ] Fresh seed produces a broadcast channel whose generated `.liq` is output-equivalent to today's static block.
- [ ] Re-running the seed is idempotent (no duplicate tiers, no error).
- [ ] An existing deployment (broadcast channel already seeded pre-config) gets the config backfilled — name the migration/backfill path in the story (one-time upsert on next seed run, or a guarded backfill).

### Unit 4: Retire the legacy now-playing consumer
**File**: `apps/api/src/services/liquidsoap.ts`
**Story**: `unified-channel-model-snctv-composition-nowplaying-consumer`
**depends_on**: `[unified-channel-model-snctv-composition-topology]`

`liquidsoap.ts:20` fetches `HARBOR_LEGACY_NOW_PLAYING` (`/now-playing`) — the broadcast-only path
being deleted in Unit 2. Repoint it at the broadcast channel's **per-channel** now-playing harbor
path (the generated `selected()`-based endpoint). Trace every caller of this function (broadcast
now-playing surfaces) and confirm the per-channel shape (`{ uri, title, elapsed, remaining, selected }`)
is compatible — it is a superset of the legacy shape, so callers reading `uri`/`title`/`elapsed`/`remaining`
are unaffected; the extra `selected` field is additive.

**Acceptance criteria**:
- [ ] `liquidsoap.ts` reads the broadcast channel's per-channel now-playing path; no reference to `HARBOR_LEGACY_NOW_PLAYING` remains.
- [ ] `HARBOR_LEGACY_NOW_PLAYING` export removed (no remaining importers — grep clean).
- [ ] Existing now-playing callers' response-shape expectations still satisfied (additive `selected` field only).

### Unit 5: Foundation-doc roll-forward
**File**: `docs/streaming.md`
**Story**: folded into Unit 2's story (small) — OR `gate-docs` at release. Default: fold into Unit 2.

`docs/streaming.md` describes S/NC TV's fallback chain as a Liquidsoap special case ("It runs a
fallback chain…"; the §"In Liquidsoap these are separate sources in the fallback chain" block).
Roll it forward to describe S/NC TV as an ordinary editorial-config channel (auto mode, 3 tiers),
with the takeover as the priority-0 live tier. Rolling-foundation is a hard rule — drift here is a
review blocker, so it lands with the topology change, not after.

## Implementation Order
1. `broadcast-render` (Unit 1) — the render learns broadcast-role affordances (no consumer yet; pure).
2. `topology` (Unit 2) — broadcast channel joins the topology, static block deleted, docs rolled forward. **The equivalence gate.**
3. `seed-config` (Unit 3) + `nowplaying-consumer` (Unit 4) — parallel after Unit 2 (independent files, both depend only on topology).

## Testing
- **Unit 1**: `liquidsoap-render.test.ts` — broadcast-role live tier renders the `:1936` input; non-broadcast renders `null`; broadcast switch emits source-switch telemetry; broadcast block uses `selected()` now-playing (no legacy path / `on_metadata`).
- **Unit 2**: `playout-topology.test.ts` + `liquidsoap-config.test.ts` — broadcast channel in `channels[]`; static `broadcast` field gone; `output.url` → `snc-tv`; **render golden: the generated broadcast block is behaviorally equivalent to the prior static tail** (the diff is the equivalence evidence, reviewed in the story).
- **Unit 3**: seed idempotency test; a config-driven render of the seeded broadcast channel matches the equivalence golden.
- **Unit 4**: `liquidsoap.test.ts` — now-playing fetch hits the per-channel path; shape compatibility.
- **Cross-cutting (live, not unit)**: `scripts/dev/test-live-fallback.sh` on the live pipeline + the staged takeover/fall-back/simulcast walk (fix-verify loopback) — the feature-level close gate.

## Risks
- **Equivalence on the production streaming path.** Every step needs output-equivalence or an
  explicit reviewed behavior change. The render golden + live-fallback + staged walk are the guard;
  the topology story (Unit 2) is the gate where equivalence is demonstrated.
- **The `notify_switch`/telemetry SPIKE NOTE survives.** The current static block carries a SPIKE
  NOTE (render line ~352): `fallback(transitions=[...])` firing semantics in LS 2.4 "must be
  validated in the dev container before relying on these in production," with a `thread.run
  is_ready()` poller as the documented fallback. Re-expressing the telemetry inherits this open
  validation — the staged walk must confirm source-switch events actually fire on the running 2.4.5
  pipeline. If transitions prove unreliable, the poller fallback is the known mitigation (named in
  `bold-event-spine-publishers` per the note).
- **Backfill for already-seeded deployments.** A live deployment has the broadcast channel but no
  editorial config; Unit 3 must backfill it, not just handle fresh seeds. Without it, an existing
  broadcast channel renders config-less (queue-only default) — a behavior regression. Named in Unit 3
  acceptance.
- **Simulcast output name.** Simulcast `on_forward` keys on the `snc-tv` stream name; the generated
  `output.url` must produce exactly that. Verified in Unit 2 acceptance; a mismatch silently breaks
  simulcast.
