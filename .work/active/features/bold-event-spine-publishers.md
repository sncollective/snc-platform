---
id: bold-event-spine-publishers
kind: feature
stage: drafting
tags: [streaming, playout]
release_binding: null
depends_on: [bold-event-spine-sse-endpoint, bold-lifecycle-transitions-playout-queue]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: bold-event-spine
---

# Event publishers at the points of knowledge

## Brief
Emit spine events from the handlers that already learn about state changes: the SRS
on_publish/on_unpublish callbacks (live channel up/down), the Liquidsoap track-event
handler (queue advanced), and media job completion (processing status). Fire-and-forget
semantics — publishing must never affect the callback/job result.

Cross-epic dependency on `bold-lifecycle-transitions-playout-queue`: queue events attach
to that module's named transitions rather than being sprinkled through the orchestrator;
if transitions are centralized first, this feature is a few lines per transition instead
of a second scattering.
