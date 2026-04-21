---
tags: [streaming]
release_binding: null
created: 2026-04-21
---

# Liquidsoap Single-Queue-Per-Output Architecture

2026-04-06: Decouple Liquidsoap from channel identity — move to a single-queue-per-output architecture where Liquidsoap is purely a decoder/encoder receiving one track at a time, and all queue/channel logic lives in the API. Currently each channel needs its own `request.queue` + harbor endpoints baked into `playout.liq`. This becomes a problem when: (a) channel count exceeds ~5 and static config becomes unwieldy, (b) zero-downtime channel management is needed, or (c) channels need to share output streams dynamically (e.g., channel scheduling on S/NC TV).

Prerequisite: config generation + restart (Option A) should be in place first. This is the full realization of "API is the orchestrator, Liquidsoap is the dumb player" from the channel architecture scoping brief.
