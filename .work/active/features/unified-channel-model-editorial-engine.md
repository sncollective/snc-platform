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
updated: 2026-06-13
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
- `.claude/skills/liquidsoap-v2/SKILL.md` — Liquidsoap capability reference for the spike
- Epic body `## Decisions` — carry model, control model, airing model (locked at workshop)
