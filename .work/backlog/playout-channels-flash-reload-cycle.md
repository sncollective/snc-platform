---
tags: [streaming, playout]
release_binding: null
created: 2026-04-22
---

# Playout channels flash black + reload every 5-10s

Playout channels flash black + show loading spinner and reload every 5-10 seconds on `/live`. Undetermined whether live streams also affected. Possibly related to the AAC 128k→256k bump landed yesterday in `playout-liq-256k-audio-bump`, or to liquidsoap/SRS HLS segment rotation cadence.

Surfaced 2026-04-22 during review of `live-page-auto-scroll` (acceptance-tested `/live` and observed the flash cycle on playout channels).
