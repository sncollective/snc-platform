---
id: bold-lifecycle-transitions
kind: epic
stage: drafting
tags: [refactor, bold]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# Status columns are secret state machines — name the transitions

## Thesis
Three domain lifecycles (playout queue entry `queued→playing→played`, content processing
`uploaded→processing→ready/failed`, stream session open→closed) are real state machines
that no module owns — transitions live as UPDATE statements and `endedAt == null` checks
scattered across orchestrator functions, job handlers, and webhook routes.

## Lens
Domain Crystallization

## Impact
Each domain gets one small transition module — the only writer of its status column, with
named transitions (`markPlayed`, `promoteNext`, `completeProcessing`, `closeSession`) and
a single place for side effects to attach. Reading one file tells you the whole
lifecycle; stray writes become grep-detectable. These named transitions are also the
natural emission points for the event spine (`bold-event-spine` consumes them).

## Cost
Touches the playout orchestrator's hot paths — that child is the feasibility test and is
designed first. Transition discovery (finding every stray status write across routes,
services, and job handlers) is the tedious part. Explicitly NOT a generic state-machine
framework: three independent domain modules, no shared abstraction unless a later
repetition proves one. Behavior-preserving throughout — same transitions, same rows, one
owner.

## Child features (riskiest first)
- **bold-lifecycle-transitions-playout-queue** *(riskiest — design this first)* — queue
  entry transitions extracted from `playout-orchestrator.ts` into a single owning module.
- bold-lifecycle-transitions-content-processing — `processingStatus` transitions
  centralized across `upload-completion.ts` and the media job handlers.
- bold-lifecycle-transitions-stream-session — session open/close transitions; single
  writer for `endedAt`.
