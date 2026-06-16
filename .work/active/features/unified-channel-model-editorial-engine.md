---
id: unified-channel-model-editorial-engine
kind: feature
stage: drafting
tags: [streaming, playout]
parent: unified-channel-model
depends_on: [unified-channel-model-identity-lifecycle]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-16
---

# Editorial engine — source tiers, manual/auto mode, live switching

## Brief
Give every channel an editorial config and make the playout engine execute it. Source
tiers per channel: live input, queue, pool, and **channel-as-source** (another channel
referenced with priority — the generalization of the hardcoded S/NC TV fallback at what
was `liquidsoap-config.ts:192`, now the broadcast block in `liquidsoap-render.ts`).
Channel-as-source needs cycle detection; the graph is shallow in practice (epic carry-model
decision). Control plane: **manual | auto** mode per channel — the architectural
commitment; specific control verbs (staged queue with arm/take, event pinning) are derived
from the workshop scenarios during this feature's design pass ("build a queue while the
pool rotates, switch over when ready"; "choose the scheduled event over the live creator"
— both expressible without a playout reset).

**The design pass MUST open with the no-restart switching spike** (epic risk, named): can
editorial changes (mode flips, source priority changes, queue arm/take) apply via live
mechanisms — Liquidsoap interactive variables / harbor-driven predicates inside a
persistent pipeline — versus supervised start/stop of per-channel pipelines
(airs-when-programmed lifecycle)? The spike settles the mechanism before any
implementation units are cut; the topology module + pure render (landed) is the seam the
chosen mechanism renders through. Fallback posture if the spike disappoints: retain
regenerate-and-restart for channel CRUD, scope live switching to within-pipeline source
changes — degraded but shippable, recorded as an explicit behavior decision.

Does NOT cover: re-programming S/NC TV onto this engine (sibling `snctv-composition` is
the first consumer and the output-equivalence gate); any editorial UI (the shared surface
is `playout-admin-redesign`'s, per its reframe); schedule/calendar tier (deferred by epic
decision — the model leaves room as a future source type).

## Epic context
- Parent epic: `unified-channel-model`
- Position in epic: the engine and the riskiest child — `snctv-composition` and
  `creator-enablement` consume it. Builds on `identity-lifecycle`'s schema for editorial
  config storage and on the landed topology/render seam.

## Foundation references
- `docs/streaming.md` — current engine architecture, harbor control API
- `.claude/skills/liquidsoap-v2/SKILL.md` — Liquidsoap capability reference; see reference.md
  §Dynamic Topology (added 2026-06-16 from the spike — `source.dynamic`, ref-driven `switch()`,
  `switch.selected()`, `interactive.*`, runtime attach/detach)
- Epic body `## Decisions` — carry model, control model, airing model (locked at workshop)

## Spike outcome (2026-06-16) — the no-restart switching spike is SETTLED

The mandated opening spike ran against the live Liquidsoap 2.4.2 container (throwaway off the
prod image; prod untouched, 0 restarts) and was extended into a source-dive against the
tag-pinned 2.4.2 tree. **Result: live editorial switching works.** Full findings + file:line
evidence are in the durable position `.research/analysis/positions/editorial-engine-switching-mechanism.md`.
Read it before designing. Headlines:

- **Editorial control (mode, priority, arm/take): live, no restart** — ref()-backed `switch()`
  predicates re-evaluate every frame at `track_sensitive=false`; harbor mutates the ref.
- **Per-channel content swap: live** via `source.dynamic` (getter returns `null`=keep / source=swap;
  child need not pre-exist).
- **Channel CRUD (add/remove whole channel): runtime attach/detach IS possible**, with one hard
  constraint — if the *last* output detaches the clock thread exits and won't auto-restart.
  Resolution: keep an always-present sentinel output (the always-on S/NC TV broadcast output
  already serves this). The epic's "fallback if spike disappoints" does NOT activate.
- **Observe via `switch.selected()`, never `on_metadata`/`on_track`** (the latter are blind to
  mid-track re-selection — cost spike time).

### Design-pass forks the spike surfaced (decide in this design, with the user)

1. **CRUD mechanism — SETTLED (2026-06-16): regenerate-and-restart now, runtime-ready later.**
   Channel CRUD uses regenerate-and-restart (re-render `.liq` + restart); runtime attach/detach is
   NOT adopted in v1 but the seam is kept ready for it. Rationale + the three seam constraints
   (broadcast output = documented sentinel; pure render; restart-agnostic control plane) are in the
   position `.research/analysis/positions/editorial-engine-switching-mechanism.md` §CRUD mechanism.
   The design pass implements this, it does not re-decide it. (Spike proved runtime CRUD *possible*;
   the editorial UX is live in both, so runtime CRUD bought only gapless structural add/remove — not
   worth the standing clock-exit invariant + least-tested paths for a rare admin action now.)
2. **Control plane (OPEN):** bespoke per-channel harbor endpoints (status quo pattern in
   `liquidsoap-render.ts`) **vs** the built-in `interactive.harbor` control surface. Must be
   restart-agnostic (seam constraint 3 above) regardless of which. Decide in the design pass.
3. **Airs-when-programmed × clock-exit — SETTLED via #1.** Under regenerate-and-restart the
   zero-output clock-exit constraint does not bind; the broadcast output is the documented sentinel
   that keeps the runtime-CRUD path available later. No open question remains here.
4. **Version dependency — RESOLVED by the audit + upgrade story.** The Liquidsoap version/gap audit
   ran (campaign `liquidsoap-version-capability-audit`); recommendation is upgrade 2.4.2 → 2.4.5
   (story `research-handoff-liquidsoap-version-capability-audit-1`, filed). 2.4.2's bugs
   (skip-from-harbor crossfade crash #5194, clock-detach-while-running #5051, `harbor.remove_http_handler`)
   are **latent** for the chosen regenerate-and-restart design — none is on a path v1 exercises — so
   this is a **soft dependency**: the upgrade should land first as good hygiene, but does not block
   the v1 design. It becomes a hard dependency only if a later iteration adopts runtime CRUD or
   crossfades.
