---
tags: [streaming, media-pipeline]
release_binding: null
created: 2026-04-21
---

# Subtitle Delivery to Player

Deliver subtitle tracks extracted during Phase 5 playout ingest to the Vidstack player via WebVTT. Depends on subtitle tracks being stored during Phase 5 ingestion (already done). The wiring from stored WebVTT files to the Vidstack `<MediaPlayer>` track selection API is the remaining work.
