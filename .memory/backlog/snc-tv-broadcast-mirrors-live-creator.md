---
tags: [streaming, playout]
release_binding: null
created: 2026-04-22
---

# S/NC TV broadcast channel should mirror currently-live creator stream

S/NC TV is the unified broadcast channel (`type: "broadcast"`). When a creator (e.g., Maya) goes live on their own channel, S/NC TV should carry that stream on its own HLS output so anyone watching S/NC TV sees whoever's currently live. Today S/NC TV appears to have its own independent output (probably a liquidsoap schedule) and doesn't route live creator streams through it.

Surfaced 2026-04-22 during `mini-player-stream-end-spinner` review — observed Maya's stream appeared on her own channel but S/NC TV stayed on whatever was already playing.

Scope questions to resolve when picked up:

- Does S/NC TV forward to / ingest the live creator's RTMP stream via SRS `forward`, or does liquidsoap pick up the creator's HLS as a fallback input?
- Priority ordering when multiple creators are live simultaneously (Animal Future doesn't hit this, but soon).
- Behavior when no creator is live — S/NC TV falls back to its current default output? A playout loop?
- Chat continuity — does the S/NC TV chat room persist or follow the currently-featured creator's room?
