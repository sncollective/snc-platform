---
tags: [media-pipeline, streaming]
release_binding: null
created: 2026-04-20
---

# VOD Recording Post-Processing

s-nc.tv Phase 7 integration point. SRS DVR records the live stream as FLV; a job queue entry picks up the file, runs `ffmpeg -c copy` to remux to MP4 with faststart, then uploads the result to Garage S3. Uses the same FFmpeg service and job queue as content upload processing.

Blocked on s-nc.tv Phase 5 playout spike completing before this can be wired up.
