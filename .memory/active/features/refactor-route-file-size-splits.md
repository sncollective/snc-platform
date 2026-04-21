---
id: feature-refactor-route-file-size-splits
kind: feature
stage: implementing
tags: [refactor, structural]
release_binding: null
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

Four API route files have grown past the 500 LOC threshold, making them harder to navigate and test in isolation. The extraction strategy for each is a logical sub-group of routes (feed queries, multipart upload, stream lifecycle orchestration) moved to a sibling file — keeping the original file as the entry point for its remaining routes. This is a structural split, not a behavioral change.

## Scope

Route files in `apps/api/src/routes/` at or over the 500 LOC threshold. Each task is a distinct file with its own extraction target.

## Tasks

- [ ] `apps/api/src/routes/content.routes.ts` (681 LOC) — extract feed query logic into `content-feed.routes.ts`; feed queries form a natural cohesive group distinct from upload/metadata operations
- [ ] `apps/api/src/routes/upload.routes.ts` (543 LOC) — extract multipart upload routes into `upload-multipart.routes.ts`; multipart flow is self-contained and independently testable
- [ ] `apps/api/src/routes/streaming.routes.ts` (537 LOC with inline callback orchestration) — extract `ensureLiveChannelWithChat`, `teardownLiveChannel`, and `extractStreamKey` orchestration logic to `services/stream-lifecycle.ts`; this also relates to the streaming-lifecycle story in active stories
- [ ] `apps/api/src/routes/booking.routes.ts` (514 LOC, optional) — 14 LOC over threshold; split only if touching nearby code makes the extraction low-friction

## Notes

`streaming.routes.ts` extraction to `services/stream-lifecycle.ts` overlaps with the streaming-lifecycle story in active stories — coordinate to avoid duplicate work or divergent extraction targets. The `booking.routes.ts` task is explicitly optional; the borderline LOC count means the split adds process cost that may not be warranted unless the file is being touched for other reasons.
