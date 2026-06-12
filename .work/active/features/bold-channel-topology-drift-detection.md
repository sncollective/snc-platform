---
id: bold-channel-topology-drift-detection
kind: feature
stage: drafting
tags: [streaming, playout]
release_binding: null
depends_on: [bold-channel-topology-model-render]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: bold-channel-topology
---

# Drift detection + one-command manual reconcile

## Brief
Detect the "DB changed but Liquidsoap restart failed/never happened" desync: embed a
topology hash in the rendered `playout.liq` (e.g. as a comment and/or exposed via the
harbor), compare expected-vs-running hash on track-event callbacks and a periodic health
tick, and surface mismatches loudly (structured log + admin playout page flag). Provide a
single manual reconcile action (admin endpoint/button or CLI) that re-renders and
restarts deliberately.

Explicitly NOT auto-reconcile — operator decision 2026-06-12: restarting a live playout
server stays a human call. Untagged (new detection behavior + admin surface), routes
through feature-design.
