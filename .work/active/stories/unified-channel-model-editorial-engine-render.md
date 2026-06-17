---
id: unified-channel-model-editorial-engine-render
kind: story
stage: review
tags: [streaming, playout]
parent: unified-channel-model-editorial-engine
depends_on: [unified-channel-model-editorial-engine-topology]
release_binding: null
gate_origin: null
created: 2026-06-16
updated: 2026-06-17
---

# Render extension — ref-driven switch() + bespoke control endpoints

Implements **Unit 3** of `unified-channel-model-editorial-engine` (full design in the feature body).
Emits the live editorial mechanism the spike settled.

## Revision (2026-06-17)

Revised per the reframed unified editorial model. Committed as `63357f1`
(implement: unified-channel-model-editorial-engine-render).

**What changed:**
- `queue` tier → three declarations: `${vid}_queue` (request.queue, operator push/skip),
  `${vid}_pool` (request.dynamic fetching `pool/next?secret=...` — until the control-service
  endpoint exists the pool is not-ready and the inner fallback skips silently, correct startup
  behavior), `${vid}_queue_program = fallback(track_sensitive=true, [queue, pool])`. The unified
  program source: operator queue plays track-by-track; when empty, pool auto-fills.
  `track_sensitive=true` so a freshly-queued item is taken at the next track boundary (arm/take).
- Control refs: `${vid}_mode`, `${vid}_manual` (was `priority`), `${vid}_armed`. No priority ref.
- `${vid}_source` in auto: readiness fallback via `switch(track_sensitive=false, [...])` with all-true
  predicates (first ready source wins). Queue tier additionally gates on `${vid}_armed()` so you can
  build the queue while another source airs.
- now-playing: elapsed + remaining kept (UI needs progress); `selected_id` from
  `switch.selected()` as a JSON-serializable `source.id` string — not the raw source object.
- Endpoints: `/queue`, `/skip`, `/now-playing` kept; `/mode`, `/arm`, `/manual` added; `/priority`
  DROPPED. Each `?secret=`-guarded.
- S/NC TV broadcast block UNTOUCHED.

**Default-channel behavior change:** a queue-only channel with no operator content previously aired
blank; now auto-fills from the pool via `request.dynamic`. This is the intended model. Until the
`pool/next` endpoint ships (control-service story), the pool is not-ready and silence falls through —
correct startup behavior.

**Goldens regenerated (3 updated: 1ch, 2ch, special-chars). Verified:**
- Readiness-fallback shape (switch with all-true predicates, armed gate on queue, mksafe tail).
- `${vid}_queue_program = fallback(track_sensitive=true, [queue, pool])`.
- `${vid}_pool = request.dynamic(...)` fetching `pool/next?secret=...` endpoint.
- Control refs: mode/manual/armed (no priority).
- now-playing: elapsed, remaining, selected_id from switch.selected().
- `${vid}_source` variable name preserved (broadcast block references it).
- Broadcast block (S/NC TV) UNCHANGED.

**Tests (Story B):** 1711 tests pass (112 test files). Goldens regenerated.

## Scope
`apps/api/src/services/liquidsoap-render.ts` — `renderChannelBlock` emits, per channel, in place of
today's `fallback([queue, blank])`:
- tier sources (`request.queue` / pool `request.dynamic` or `playlist` / `input.rtmp` / referenced
  channel `_source`);
- control refs `${vid}_mode`, `${vid}_priority`, `${vid}_armed`, initialized from persisted config
  (restart-agnostic);
- ref-driven `switch(track_sensitive=false, [...])` — auto = priority-ordered predicates, manual = pin
  `manualTierIndex`, always an `mksafe(blank())` ready tail;
- now-playing read from **`switch.selected()`** (NOT `on_metadata` — position gotcha #1);
- bespoke harbor endpoints: existing POST queue / POST skip / GET now-playing (now selected-based) **plus**
  POST mode / POST priority / POST arm — each with the `?secret=` guard.

Render stays **pure + byte-deterministic**. **The static S/NC TV broadcast block is untouched** (scope
boundary — `snctv-composition` migrates it).

## Acceptance criteria
- [x] Golden `.liq` tests: byte-identical output for identical topology.
- [x] switch() shape, control refs, all six endpoints, and `switch.selected()` now-playing present.
- [x] manual vs auto predicate shapes correct; `mksafe(blank())` tail always present.
- [x] Existing channel + broadcast goldens for unchanged paths still pass (broadcast block unchanged).

## Implementation notes

### Files changed
- `apps/api/src/services/liquidsoap-render.ts` — `renderChannelBlock` rewritten; two private helpers extracted (`renderTierSource`, `renderSwitchPredicates`); `PlayoutEditorialTier` import added.
- `apps/api/src/services/playout-topology.ts` — `PlayoutChannelTopology["harborPaths"]` type extended with `mode`, `priority`, `arm`; `harborChannelPaths` function extended to emit all six paths.
- `apps/api/tests/services/playout-topology.test.ts` — `harborChannelPaths` test updated to assert all 6 paths (was 3).
- `apps/api/tests/services/__snapshots__/playout-1ch.liq`, `playout-2ch.liq`, `playout-special-chars.liq` — goldens regenerated (playout-0ch.liq unchanged: no channel blocks).

### Switch-predicate encoding chosen

**AUTO mode:** each tier produces a predicate of the form `{ ${vid}_armed() and ${vid}_priority() == <index> }` (queue tier) or `{ ${vid}_priority() == <index> }` (all other tier types). The queue tier specifically gates on the `armed` ref because the arm/take pattern is queue-specific. Priority refs drive tier selection: the operator sets `priority` to the index of the desired active tier, which trips that predicate and selects it. Always ends with `({ true }, mksafe(blank()))`.

**MANUAL mode:** a single `({ true }, pinnedVar)` predicate pins `manualTierIndex` → the source at that index. Still followed by the `mksafe(blank())` tail.

The `arm` ref and `priority` ref are orthogonal: `arm` gates the queue specifically; `priority` selects among all tiers. An operator can arm the queue at priority 0 while keeping a live tier at priority 1 (the live tier gates only on priority, not arm). To take the queue, bump priority to 0 and arm it; to return to live, bump priority to 1.

### Queue-only-default behavioral equivalence

For a channel with no editorial config (one queue tier, auto mode), the render emits:
```liquidsoap
ch_..._armed = ref(true)   # initialized true — queue plays by default
ch_..._source = switch(track_sensitive=false, [
  ({ ch_..._armed() and ch_..._priority() == 0 }, ch_..._queue),
  ({ true }, mksafe(blank()))
])
```
With `armed=true` and `priority=0` (the initial values), this resolves identically to the former `fallback(track_sensitive=false, [queue, mksafe(blank())])`: the queue plays whenever it has pending items (`is_ready`), else the `mksafe` tail fires silence. The ref-driven switch re-evaluates every frame (`track_sensitive=false`), matching the fallback's frame-by-frame readiness check. Behavioral equivalence is maintained.

### Pool tier primitive choice

Pool tiers are rendered as `request.queue(id="${poolQueueId}")` — consistent with the current code pattern (no unproven Liquidsoap primitives introduced). The `poolQueueId` from topology is the same as the channel queue ID in the current default config; real pool configs (when configured via the editorial schema) will carry a distinct `poolQueueId`. This is a known interim state: the pool content source primitive (`request.dynamic` / `playlist` driven by `channel_content`) will be wired up in a follow-up unit, not here. Parked: pool primitive refinement is a follow-up for the control-service unit or a dedicated story.

### Goldens regenerated and verified (golden inspection findings)

- **playout-0ch.liq**: UNCHANGED — no channel blocks rendered; broadcast block identical to pre-change. ✅
- **playout-1ch.liq**: switch shape correct; all 3 control refs present (mode="auto", priority=0, armed=true); all 6 endpoints present; now-playing reads `source.selected()`; `mksafe(blank())` tail present; `_source` variable name preserved (used in broadcast block at line 162); broadcast block UNCHANGED. ✅
- **playout-2ch.liq**: both channels independently have correct switch/refs/endpoints; Channel A's `_source` referenced in broadcast fallback (correct — first channel); broadcast block UNCHANGED. ✅
- **playout-special-chars.liq**: same structure as 1ch with escaped channel name in comment; broadcast block UNCHANGED. ✅

### Parked issues
- **Live tier ingest URL**: `renderTierSource` for `live` tiers derives `rtmp://0.0.0.0:${broadcastInputPort}/live/${srsStreamName}` from available topology data. No current test scenario has a live tier; this URL path is provisional and should be refined when live tiers are actually configured in practice. A `liveIngestUrl` field in `PlayoutEditorialTier` (topology extension) is the clean fix.
- **Pool primitive**: rendered as `request.queue` (provisional); `request.dynamic`/`playlist` driven by `channel_content` rows is the intended future shape.
- **Priority encoding for multi-tier AUTO**: the current design uses priority index as the gate value (operator sets ref to the integer index of the desired tier). This is clean and simple but means the operator must know the integer index. A named-tier or slug-based ref is a possible UX improvement for the control-service unit.
