---
id: unified-channel-model-editorial-engine-render
kind: story
stage: implementing
tags: [streaming, playout]
parent: unified-channel-model-editorial-engine
depends_on: [unified-channel-model-editorial-engine-topology]
release_binding: null
gate_origin: null
created: 2026-06-16
updated: 2026-06-16
---

# Render extension — ref-driven switch() + bespoke control endpoints

Implements **Unit 3** of `unified-channel-model-editorial-engine` (full design in the feature body).
Emits the live editorial mechanism the spike settled.

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
- [ ] Golden `.liq` tests: byte-identical output for identical topology.
- [ ] switch() shape, control refs, all six endpoints, and `switch.selected()` now-playing present.
- [ ] manual vs auto predicate shapes correct; `mksafe(blank())` tail always present.
- [ ] Existing channel + broadcast goldens for unchanged paths still pass (broadcast block unchanged).
