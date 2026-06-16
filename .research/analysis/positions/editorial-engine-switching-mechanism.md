---
status: settled
authored: 2026-06-16
provenance: agent-spike
related:
  - to: liquidsoap-playout-engine.md
    type: cites
    note: parent engine selection; this settles a downstream mechanism question
  - to: tv-model-playout-architecture.md
    type: cites
    note: the editorial/airing model this mechanism serves
revisit_if:
  - Liquidsoap upstream changes switch()/ref semantics (major version, deprecation of getter-driven predicates)
  - A control verb emerges that ref-driven switch() predicates cannot express (e.g. per-frame compositing, sub-second crossfade scheduling) — escalate to per-channel pipeline supervision for that verb only
  - Production validation against real request.queue + input.rtmp sources contradicts the sine-based spike's readiness assumptions
  - The mksafe-default-tier "take glitch" (below) reproduces with real sources holding readiness
---

# Position: editorial-engine switching mechanism — live ref-driven `switch()`, no restart

**Status: settled by spike (2026-06-16).** Editorial changes — mode flips (manual ↔ auto),
source-priority changes, queue arm/take — apply to a **persistent** Liquidsoap pipeline at
runtime via **mutable `ref()` cells read inside `switch()` predicates**, mutated through harbor
HTTP, with **no process restart**. The supervised per-channel start/stop alternative is rejected
for editorial control (retained only for channel CRUD — see Boundary).

This is the no-restart switching spike the `unified-channel-model` epic named as its central
technical risk. The spike is empirical: run against a throwaway container off the production
`platform-snc-liquidsoap` image (Liquidsoap 2.4.2), it confirmed the mechanism. The production
playout container was never touched.

## The mechanism

A channel's editorial priority is expressed as a `switch()` over its source tiers, where each
tier's predicate reads live-mutable control state:

```liquidsoap
priority    = ref("a")        # which background source wins
queue_armed = ref(false)      # arm/take

selected = switch(track_sensitive=false, [
  ({ queue_armed() },        armed_queue ),   # queue tier (arm/take)
  ({ priority() == "b" },    source_b ),       # selected background
  ({ true },                 mksafe(blank()) ) # always-ready default tail
])
```

`switch()` re-evaluates its predicates continuously against the clock. A harbor `POST` mutates a
`ref`; the next frame re-selects. `switch.selected()` is the authoritative introspection — it
returns the currently-selected child source (NOT `on_track`/`on_metadata`, which are blind to
mid-track re-selection and gave a false "stuck" reading during the spike — see Gotchas).

This **generalizes line-192** (`snc_tv = fallback([live_source, snc_tv_queue, defaultPlayoutSource, blank()])`):
the hardcoded fallback chain becomes a ref-driven `switch()` whose tiers and priorities are
editorial config, mutated live.

## What the spike proved

Against the live container, same PID throughout (`/proc/1/stat` starttime constant, docker
`RestartCount: 0`):

- **Upward switches are instant.** Arming the queue tier preempts the background source on the
  next frame; raising priority preempts. Confirmed via `switch.selected()`.
- **Downward switches are instant** when the lower tier holds readiness. Un-arming returns to the
  background source; lowering priority returns to the default. Confirmed.
- **The infallible output never went dead.** With `output.dummy(fallible=false, ...)` and an
  `mksafe(blank())` default tail, `selected.is_ready()` was `true` across every transition — the
  pipeline never glitched to silence during a switch.
- **Interactive variables (`interactive.float`/`string`) mutate live too** — a parallel control
  channel for continuous params (gain, etc.) if ever needed, same no-restart property.

## Gotchas (load-bearing for implementation)

1. **Observe via `switch.selected()`, never `on_track`/`on_metadata`.** `on_track` only fires at
   a *new* selected source's track boundary; on continuous sources it never re-fires, so it reads
   as "stuck on the old leaf" while the audio has actually switched. The spike chased this false
   signal before finding `.selected()`. The production now-playing endpoints must read selected
   state directly, not infer it from the last metadata callback.

2. **The default-tier "take glitch" is a bare-`sine` artifact, NOT a mechanism flaw.** When a
   higher tier was a bare `sine()` and got un-selected, the sine didn't hold readiness across
   re-selection, so a downward switch sometimes resolved to the always-ready `mksafe` default
   instead of the intended middle tier. Real production sources — a `request.queue` that stays
   armed, an `input.rtmp` that stays connected — hold readiness continuously, so this won't occur.
   **Validate against real sources** before relying on intermediate-tier downward switches
   (recorded in `revisit_if`).

3. **v2.4 callbacks require `synchronous=`.** `on_track`, `on_metadata` all need the explicit
   `synchronous` parameter (Error 15 otherwise) — already a known engine gotcha, re-confirmed here.

## Boundary: live switching vs channel CRUD

Refined 2026-06-16 by a source-dive into the Liquidsoap 2.4.2 tree (cloned, tag-pinned). The
CRUD boundary is **softer than first stated** — the engine supports more runtime topology change
than the "any structural change restarts" first cut assumed.

- **Editorial control (mode, priority, arm/take, channel-as-source priority): live, no restart.**
  Ref mutations inside an existing pipeline. `switch()` re-evaluates its predicates every frame
  when `track_sensitive=false` (confirmed in `src/core/base/operators/switch.ml` — `satisfied d`
  applies the predicate fresh each cycle), so a ref-backed predicate causes live re-selection.

- **Per-channel content swap (change what a tier *plays* without re-rendering the tier): live, via
  `source.dynamic`.** `source.dynamic` (`src/core/base/operators/dyn_op.ml`) takes a getter
  `() -> source?`; returning `null` keeps the current child, returning a source swaps it — and the
  child need NOT have existed at parse time (the getter can create it on demand). My initial spike
  crashes were getter-contract mistakes (a `null`-init wake-up and a wrong getter shape), not an
  engine limitation. This is the primitive for swapping a channel's pool/queue content live.

- **Channel CRUD (add/remove a whole channel = a new `output.url` + source chain): runtime
  attach/detach IS supported, with ONE hard constraint.** `clock.ml` exposes `attach`/`detach`
  (flushed once per tick); a new output created at runtime attaches itself and activates on the
  next tick, and an output can be detached live. **The constraint:** the clock thread runs only
  `while has_sources_to_process()` (`clock.ml` `_clock_thread`) — if the *last* output is
  detached, the clock thread exits and does NOT auto-restart on a later attach (needs an explicit
  `Clock.start`, not script-reachable). So:
  - Add a channel live: ✅ supported.
  - Remove a channel while ≥1 other output remains: ✅ supported.
  - Drain to zero outputs then add again: ❌ needs a kept-alive sentinel output (e.g. a permanent
    `output.dummy`/blank) or a process restart.

**Implication for the airs-when-programmed model.** The epic's lifecycle (a pipeline exists only
while something is programmed; zero cost when nothing airs) collides with the zero-output
clock-exit constraint IF "nothing programmed" means "zero outputs." The clean resolution: keep a
single always-present sentinel output (the S/NC TV broadcast output is already always-on and
serves this role), so the clock never drains to zero, and individual channel outputs
attach/detach around it freely. This is a real design input the feature must absorb — recorded
here, decided in the design pass.

The render seam (`liquidsoap-render.ts` + `playout-topology.ts`, landed) is still where the chosen
mechanisms render. Whether to drive CRUD via runtime attach/detach (one persistent process, more
moving parts in-engine) or retain regenerate-and-restart for CRUD (simpler, brief audio gap on the
affected channel only) is a **design-pass fork**, not settled here — the source-dive proves
runtime CRUD is *possible*; it does not prove it's the *right* operational tradeoff. The
high-frequency editorial path (arm/take, mode, priority, content swap) is fully live regardless.

The epic's "fallback posture if the spike disappoints" does **not** activate — the spike
succeeded, and the capability surface is broader than the brief assumed.

## Control-plane surface (source-dive findings)

- **`interactive.float`/`string`/`bool` ship a built-in HTTP mutation surface** — `interactive.harbor`
  (`src/libs/extra/interactive.liq`) registers GET (a control webpage) + POST (a setter) on a
  harbor port. A first-class control plane exists without writing custom harbor handlers per
  variable; the variables are global refs mutated via `.set` or HTTP POST. Candidate for the
  mode/priority control plane if we prefer it over bespoke harbor endpoints.
- **`switch.selected()` is the authoritative now-selected introspection** (`src/libs/switches.liq`) —
  re-confirmed; the now-playing/now-airing endpoints must read it, not infer from `on_metadata`.
- **The telnet/server command surface is unauthenticated, localhost-bound by default**
  (`src/core/base/tools/server.ml` — `conf_telnet` default `false`, `bind_addr` default
  `127.0.0.1`; "there is currently no authentication"). `server.harbor` bridges server commands
  over HTTP, inheriting zero auth — do NOT expose it off localhost. Our skill's telnet warning is
  correct.
