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

## Input from live-experience-redesign epic design (2026-06-12)
The live-state truth decision (user call) adds a publisher source this brief didn't
name: **Liquidsoap input-switch telemetry** — which source the playout engine is
actually airing (live input vs playout fallback), so `channel.live-state-changed`
covers takeovers that bypass SRS, not just keyed on_publish/on_unpublish sessions.
The track-event handler path Liquidsoap→API already exists; input-switch events
should ride the same mechanism. `live-experience-redesign-live-state` depends on
this feature and consumes that event.
