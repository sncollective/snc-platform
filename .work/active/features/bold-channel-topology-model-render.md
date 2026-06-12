---
id: bold-channel-topology-model-render
kind: feature
stage: drafting
tags: [refactor, streaming, playout]
release_binding: null
depends_on: [refactor-playout-stream-names-dedup]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: bold-channel-topology
---

# Topology module + pure render of playout.liq

## Brief
Introduce a typed topology module that assembles the full playout/streaming topology
(channels with UUIDs and `srsStreamName`s, harbor/RTMP/API ports, callback URLs, secret
references) from DB channel state + env config, and replace the string-builder in
`apps/api/src/services/liquidsoap-config.ts` (~307 LOC) with a pure render function over
that topology. The rendered `.liq` must be byte-identical (or provably equivalent) to
today's output for the same inputs — golden-file tests against the current generator are
the verification spine. `regenerateAndRestart()` keeps its current semantics in this
feature; only the source of the rendered text changes.

Behavior-preserving: same `.liq` out, same restart signal, no caller-visible change.

Depends on `refactor-playout-stream-names-dedup` (in-flight) because the topology module
becomes the natural owner of stream-name constants — let that extraction land first and
build on its placement.

This is the riskiest child: if the topology model can't cleanly express what the string
builder does (per-channel queue/source variable naming, fallback wiring, harbor handlers),
the epic's premise fails. Design this first via /agile-workflow:refactor-design.
