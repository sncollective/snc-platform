---
tags: [streaming, media-pipeline]
release_binding: null
created: 2026-04-20
---

# Multi-Rendition Playout Transcoding

Currently skipped: Liquidsoap re-encodes source files to FLV/RTMP on the fly regardless of uploaded MP4 renditions, making intermediary renditions redundant for the playout path. Multi-rendition transcoding for playout only becomes relevant if serving HLS directly from S3 (bypassing Liquidsoap) or adding ABR adaptive bitrate playback.

Only revisit if the playout delivery model changes to direct S3 HLS serving or ABR is prioritized.
