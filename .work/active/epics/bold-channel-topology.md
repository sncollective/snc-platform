---
id: bold-channel-topology
kind: epic
stage: drafting
tags: [refactor, bold, streaming, playout]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# The channel topology is data, not a side effect

## Thesis
The playout/streaming stack's real source of truth is an implicit topology (channels,
stream names, ports, secrets, callback URLs) that exists only as string conventions
smeared across five files in three languages — and the subsystem's worst failure modes
are all desync between those copies.

## Lens
Declarative

## Impact
A typed topology module (derived from DB channel state + env) becomes the single source.
`playout.liq` becomes a pure render of it (replacing the string-builder in
`apps/api/src/services/liquidsoap-config.ts`). Startup assertions fail fast when
`srs.conf` / docker-published ports / env disagree with the topology — those infra files
stay hand-maintained but validated, not generated. Config-hash drift detection surfaces
the "DB updated but restart signal failed" desync loudly, with a one-command manual
reconcile. The string-matching contracts (UUID-embedded Liquidsoap variable names,
`srsStreamName` agreement, `PLAYOUT_CALLBACK_SECRET` rotation hazard, ports hardcoded in
3–5 places each) disappear as a category.

## Cost
This is the production streaming path. The render swap must produce behavior-identical
`.liq` output before anything else lands. Full auto-reconcile was considered and
deliberately narrowed to detect-plus-manual (operator decision 2026-06-12): auto-restarting
a live playout server is a sharp tool; drift detection + loud surfacing + manual
reconcile captures the safety value without the live-output risk. Over-engineering risk
if the topology grows into a config framework — the discipline is one typed document plus
dumb renderers, nothing more.

## Enabler role (2026-06-12)
The `unified-channel-model` epic (channel = receiver; editorial decides what airs;
identity/state split) depends on this epic's `model-render` child: the typed model +
pure render seam is the surface the unification then re-shapes. This epic stays
strictly behavior-identical — do NOT pull unification semantics into the render swap;
that separation is what keeps this reviewable as a refactor.

## Child features (riskiest first)
- **bold-channel-topology-model-render** *(riskiest — design this first)* — typed
  topology module + pure render of `playout.liq`, output-identical to today.
- bold-channel-topology-startup-assertions — fail-fast validation that env, `srs.conf`,
  and published ports agree with the topology.
- bold-channel-topology-drift-detection — config-hash drift detection on callbacks /
  health ticks, loud surfacing, one-command manual reconcile.
