---
id: streaming-clip-live-edge-instant
kind: feature
tags: [streaming]
parent: null
depends_on: [streaming-clip-dvr-enablement]
release_binding: null
gate_origin: null
research_origin: stream-clipping-twitch-parity
created: 2026-06-24
updated: 2026-06-24
---

# Instant live-edge clipping (Twitch-parity "full" target)

The harder, later target beyond the YouTube-style MVP (clip a recording after the fact). Twitch's
differentiator is **instant live-clip from a ~85-second rolling buffer** — "clip what just happened"
during the broadcast. S/NC's current ~10s HLS retention is far short of that.

Scope (two *separate* requirements — do not conflate):
- A much larger rolling **retention** buffer (closes the ~10s → ~85s rewind-depth gap) so a viewer
  can reach back ~85s to clip a moment that just passed.
- Low **creation latency** so the clip is available quickly after the click.

Likely builds on `streaming-clip-dvr-enablement` (segment-plan DVR or an extended buffer) plus the
clip-extraction path from `streaming-clip-creation`. Defer until the MVP (post-stream / uploaded-VOD
clipping) is proven.

## Research grounding

**Source**: `.research/analysis/campaigns/stream-clipping-twitch-parity/parent.md` (slug: `stream-clipping-twitch-parity`)

The "full" tier of the campaign's MVP-vs-full split; the retention-vs-latency distinction was
sharpened in cross-model peer review.
