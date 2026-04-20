---
tags: [streaming, ux-polish, media-pipeline]
release_binding: null
created: 2026-04-20
---

# Global player live-stream layout issues

Visible problems on the global player rendering a live stream (observed in a session screenshot 2026-04-20):

- **Timecode overlay** at top-left shows elapsed time like `00:00:15 392` (HH:MM:SS mmm?). Live streams shouldn't surface a scrubber-style timecode — it's either meaningless (always growing since mount) or confusing (is it show time? session time?). Expected: no timecode on live, or a "LIVE" indicator only.
- **Top-left control cluster** (expand-from-PiP arrow + close X) renders with the two buttons overlapping rather than laid out. Either the icons are drawn in the same grid cell or the flex layout collapsed.
- **Player size/position.** Appears to be in mini / PiP mode but takes an unusually large portion of the viewport — scaling or aspect ratio miscalculated when source is the live SMPTE-bar test pattern.

Right-side controls (settings gear, volume speaker, bottom-right fullscreen) render correctly; LIVE badge + content label at bottom render correctly.

Likely a regression in the mini/PiP layout branch of `global-player.tsx` or `global-player.module.css`, possibly specific to live-source dimensions. Test with live-channel playback on any page where the global player is mounted (any page other than `/live` itself, since `/live` uses the main player).

## Verification when picked up

- [ ] Timecode overlay hidden on live sources (or swapped for a static LIVE pill)
- [ ] Top-left control cluster lays out horizontally without overlap
- [ ] PiP / mini size respects expected dimensions across live + VOD sources
- [ ] No regression on VOD playback (same component serves both)
