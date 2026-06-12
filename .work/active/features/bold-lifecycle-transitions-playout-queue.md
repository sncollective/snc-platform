---
id: bold-lifecycle-transitions-playout-queue
kind: feature
stage: drafting
tags: [refactor, playout]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: bold-lifecycle-transitions
---

# Playout queue entry transitions: one owning module

## Brief
Crystallize the queue-entry lifecycle (`queued → playing → played`, plus admin
insert/remove/skip) into a single transition module that is the only writer of the queue
status column. Today the transitions are scattered through
`apps/api/src/services/playout-orchestrator.ts` (~974 LOC): `onTrackStarted` promotes
queued→playing and marks old→played, `insertIntoQueue` creates queued entries,
`removeFromQueue` guards on `status === "playing"` inline. The orchestrator keeps its
orchestration (auto-fill, prefetch push, Liquidsoap client calls) but delegates every
status mutation to named transitions.

Behavior-preserving: same DB writes in the same order under the same conditions —
verified by the existing orchestrator unit tests plus new transition-module tests.

Riskiest child of the epic (hot path, concurrent track events + admin mutations) —
design first via /agile-workflow:refactor-design. The named transitions become the
emission points for `bold-event-spine-publishers`, which depends on this feature.
