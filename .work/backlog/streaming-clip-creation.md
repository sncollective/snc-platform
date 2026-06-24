---
id: streaming-clip-creation
tags: [streaming, community, media-pipeline]
release_binding: null
research_origin: stream-clipping-twitch-parity
depends_on: [streaming-clip-dvr-enablement]
created: 2026-04-20
updated: 2026-06-24
---

# Clip Creation and Sharing

Allow viewers and creators to create shareable clips from live streams or VODs using SRS DVR output and timestamp access. A clip is a short excerpt (e.g., 30 seconds to 3 minutes) extracted from a recorded stream, stored as its own media item, and shareable via a unique URL. Requires SRS DVR recording to be in place and a clip extraction job in the media-pipeline.

## Pattern references

See [live-streaming-ux-patterns.md §1.3 Control bar](../../.research/analysis/briefs/live-streaming-ux-patterns.md) for Twitch's pattern:

- **Clip button** placed in the control bar (typically bottom-right, left of share). Opens a modal, not an in-player trim.
- **Clip window** — 60 seconds total (30s pre-click + 30s post-click). Modal shows a preview scrubber over that window for start/end adjustment within the fixed duration.
- **No in-player trim** — finalization clicks create the clip + return a shareable URL. Further trimming + title + thumbnail happens post-creation in a Clips dashboard.
- **Mobile** — simplified button; trim UI unavailable; creation-only. YouTube, Kick, Owncast have no native equivalent.

## Scoping notes

- Storage: clips are first-class media items (tagged `media-pipeline`) not ephemeral views over DVR. Extraction job writes clip to Garage as a standalone file so it survives DVR rolloff.
- UX sharp edge: pre-click window requires DVR buffer of ≥30s; research doesn't address what happens when a user clicks clip at second 10 of a stream. Define fallback (clip start snaps to stream-start? shorter clip? error?).
- Consider community-highlights-reel (sibling item) as the downstream consumer — clip schema should support ranking/selection metadata from day one.

## Research grounding

**Source**: `.research/analysis/campaigns/stream-clipping-twitch-parity/parent.md` (slug: `stream-clipping-twitch-parity`) — full-rigor campaign, cross-model peer-reviewed (3 passes). It grounds + corrects this item:

- **The click-at-second-10 edge is answered.** Today SRS keeps only a ~10s HLS rolling window (no DVR), so a live-edge clip can reach at most ~10s back. A real pre-click buffer needs DVR (or a larger rolling *retention* buffer) — see the `streaming-clip-dvr-enablement` dependency. Until then the fallback is clip-from-VOD-after-stream.
- **Schema correction.** The clip record needs more than source-link + offsets: a **clipper identity** (the member who clipped — NOT `content.creatorId`, which is a creator-profile FK), a **moderation/visibility state**, and a **storage-object key** distinct from clip identity (the dedup join-point), plus a defined source-deletion behavior.
- **Cheapest first slice.** Clipping an already-uploaded VOD (a Garage object) needs **no DVR**; DVR is the gate only for stream-derived clips.
- **Dedup key.** Reliable = (same source + tolerance-bucketed near-identical offsets) or an output-content hash — not perceptual-hash (a weak secondary signal for video).
- **Extraction.** FFmpeg stream-copy (keyframe-bounded precision) via a pg-boss `clip-extract` job, reusing the existing processing pipeline.

Sibling surfaces emitted separately (same `research_origin`): `streaming-clip-dvr-enablement`, `streaming-clip-moderation-dmca`, `streaming-clip-live-edge-instant`.
