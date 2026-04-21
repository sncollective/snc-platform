---
tags: [streaming, ux-polish]
release_binding: null
created: 2026-04-21
---

# S/NC TV Not Playing on /live When No Live Stream Active

S/NC TV is not visually playing on the `/live` page when no live stream is active — the HLS player may not auto-connect to the playout stream in this state. Retest after the non-AV stream strip fix: playout tracks were previously hanging in Liquidsoap's decoder due to data streams (timecode, camera telemetry) in uploaded source files. The remux step in playout ingest now strips these before S3 upload. If the issue persists after that fix, investigate the HLS player initialization path for the playout channel case versus the live creator case.
