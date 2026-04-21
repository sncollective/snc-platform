---
tags: [streaming, media-pipeline]
release_binding: null
created: 2026-04-20
---

# ABR Transcoding Strategy

FFmpeg sidecar with VAAPI hardware encoding for adaptive bitrate (ABR) live stream delivery. Target hardware: Intel UHD 630 / i7-10700 CQP mode. Design should abstract the hwaccel backend for future GPU/arch support. Rendition ladder and codec strategy covered in the multi-platform strategy research. Include an audio-only rendition for music streaming on mobile.

The Owncast-era workaround in the deploy guide for streaming phases 1-2 documents the prior approach. ABR is a meaningful viewer-side quality improvement but requires significant infrastructure investment; revisit when viewer count or mobile usage justifies the transcoding overhead.
