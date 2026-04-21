---
id: story-refactor-streaming-lifecycle-service-extraction
kind: story
stage: implementing
tags: [refactor, structural, streaming]
release_binding: null
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

Extract the inline callback orchestration from `streaming.routes.ts` into a dedicated service module so the route file shrinks below 400 LOC and the lifecycle logic is independently testable.

## Scope

- `apps/api/src/routes/streaming.routes.ts` — extract `ensureLiveChannelWithChat`, `teardownLiveChannel`, and `extractStreamKey` out of the route file body. After extraction the route file wires these calls but does not implement them inline.
- `apps/api/src/services/stream-lifecycle.ts` (new) — receives the three extracted functions. Follows the `Result`-returning service pattern used by sibling services. Imports from `channels.ts`, `chat.ts`, and any other service-layer modules as needed; does not import from route files.

## Tasks

- [ ] Create `apps/api/src/services/stream-lifecycle.ts` with `ensureLiveChannelWithChat`, `teardownLiveChannel`, and `extractStreamKey`.
- [ ] Replace inline implementations in `streaming.routes.ts` with imports from the new module.
- [ ] Confirm `streaming.routes.ts` drops to under 400 LOC after extraction.
- [ ] Run `bun --cwd=./platform run --filter @snc/api test:unit` to verify no regressions.

## Notes

`streaming.routes.ts` is currently 537 LOC. The three orchestration functions are the primary bloat — the rest of the file is standard route handler boilerplate. The new service should expose plain async functions returning `Result` (consistent with `channels.ts`, `playout.ts`); avoid returning raw throws so callers can pattern-match on `.ok`. Companion structural work (splitting the broader route file) is tracked separately under the route-file-size feature.
