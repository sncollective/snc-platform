---
tags: [media-pipeline, deploy]
release_binding: null
created: 2026-04-20
---

# Media Pipeline: FFmpeg Binary in Production Docker Image

Add FFmpeg to the production Docker image via `apt-get install ffmpeg`. FFmpeg is already present in the dev container; this gap means media transcoding, thumbnail extraction, and codec probing jobs will fail in production until the binary is available. Requires a production deployment to take effect.
