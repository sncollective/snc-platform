---
id: bold-lifecycle-transitions-content-processing
kind: feature
stage: drafting
tags: [refactor, media]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: bold-lifecycle-transitions
---

# Content processing transitions: one owning module

## Brief
Centralize the `processingStatus` lifecycle (`uploaded → processing → ready | failed`)
into one transition module. Today the transitions are implicit across
`apps/api/src/services/upload-completion.ts` and the media job handlers
(`apps/api/src/jobs/handlers/probe-codec.ts`, transcode, thumbnail): some steps never
explicitly set a status, some set it in handler cleanup logic, and tracing the full
lifecycle requires reading three files. After this feature, job handlers call named
transitions (`beginProcessing`, `completeProcessing`, `failProcessing`) and nothing else
writes the column.

Behavior-preserving: same status values written at the same points in the pipeline.
