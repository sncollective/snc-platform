---
tags: [streaming, community, media-pipeline]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Clip Creation and Sharing

Allow viewers and creators to create shareable clips from live streams or VODs using SRS DVR output and timestamp access. A clip is a short excerpt (e.g., 30 seconds to 3 minutes) extracted from a recorded stream, stored as its own media item, and shareable via a unique URL. Requires SRS DVR recording to be in place and a clip extraction job in the media-pipeline.

## Pattern references

See [live-streaming-ux-patterns.md §1.3 Control bar](../research/live-streaming-ux-patterns.md) for Twitch's pattern:

- **Clip button** placed in the control bar (typically bottom-right, left of share). Opens a modal, not an in-player trim.
- **Clip window** — 60 seconds total (30s pre-click + 30s post-click). Modal shows a preview scrubber over that window for start/end adjustment within the fixed duration.
- **No in-player trim** — finalization clicks create the clip + return a shareable URL. Further trimming + title + thumbnail happens post-creation in a Clips dashboard.
- **Mobile** — simplified button; trim UI unavailable; creation-only. YouTube, Kick, Owncast have no native equivalent.

## Scoping notes

- Storage: clips are first-class media items (tagged `media-pipeline`) not ephemeral views over DVR. Extraction job writes clip to Garage as a standalone file so it survives DVR rolloff.
- UX sharp edge: pre-click window requires DVR buffer of ≥30s; research doesn't address what happens when a user clicks clip at second 10 of a stream. Define fallback (clip start snaps to stream-start? shorter clip? error?).
- Consider community-highlights-reel (sibling item) as the downstream consumer — clip schema should support ranking/selection metadata from day one.
