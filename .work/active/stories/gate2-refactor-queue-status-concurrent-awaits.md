---
id: gate2-refactor-queue-status-concurrent-awaits
kind: story
stage: implementing
tags: [refactor, perf]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: refactor
created: 2026-06-29
updated: 2026-06-29
---

# Queue-status performs independent DB reads sequentially (single + multi channel)

## Severity
High (2 findings, same file — bundled)

## Location
`apps/api/src/services/playout/queue-status.ts:31,44` (single) + `:67,76,89` (multi)

## Remediation direction
Run independent reads (queueRows/poolCount; channelRows/queueRows/poolCounts) via Promise.all after the channel guard. Behavior-preserving.
