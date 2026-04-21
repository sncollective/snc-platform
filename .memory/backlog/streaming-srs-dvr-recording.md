---
tags: [streaming]
release_binding: null
created: 2026-04-21
---

# SRS DVR Recording Trigger

Configure SRS DVR to start FLV recording triggered by the `on_publish` callback (depends on Phase 4 callback infrastructure, which shipped). SRS native DVR writes the live stream to disk as FLV when a creator starts publishing. The FLV output is the input for the post-processing pipeline (remux → S3 upload) which handles the rest of the recording lifecycle.
