---
id: gate2-refactor-autofill-queueprojections-jsdoc
kind: story
stage: review
tags: [refactor, documentation]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: refactor
created: 2026-06-29
updated: 2026-06-29
---

# Exported auto-fill + queue-projection helpers lack JSDoc

## Severity
High (2 findings, adjacent files — bundled)

## Location
`apps/api/src/services/playout/auto-fill.ts:118` (queueDepthBelowAutoFillThreshold) + `apps/api/src/services/playout/queue-projections.ts:48,69` (toQueueEntry, toChannelContent)

## Remediation direction
Add concise /** */ JSDoc to each exported helper. Behavior-preserving.

## Implementation note
Added concise one-line JSDoc to the auto-fill threshold helper and both queue projection helpers. Verification not run per orchestration instruction.
