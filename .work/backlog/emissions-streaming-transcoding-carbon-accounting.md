---
id: emissions-streaming-transcoding-carbon-accounting
tags: [emissions, streaming]
release_binding: null
created: 2026-04-20
updated: 2026-06-18
---

# Emissions Streaming Transcoding and Delivery Carbon Accounting

Account for carbon emissions from live and VOD streaming transcoding and delivery (CDN, compute). Cross-cutting with the streaming domain.

Migrated from feature backlog 2026-03-25.

## Schema slice (absorbed from streaming-emissions-schema-extension, 2026-06-18)

The concrete first implementing step: extend the emissions tracking schema with
`streaming-transcoding` and `streaming-delivery` categories. `streaming-transcoding` covers
CPU/energy cost of SRS + Liquidsoap live transcoding; `streaming-delivery` covers CDN/bandwidth
for HLS delivery to viewers. Hooks into the broader emissions calculation engine (was Phase 8
scope). The accounting need above is the parent; this schema extension is its first slice.
