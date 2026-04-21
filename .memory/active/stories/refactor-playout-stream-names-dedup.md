---
id: story-refactor-playout-stream-names-dedup
kind: story
stage: implementing
tags: [refactor, quality, streaming]
release_binding: null
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

Eliminate the duplicate `PLAYOUT_STREAM_NAMES` constant between `streaming.routes.ts` and `seed-channels.ts` by extracting it to a shared location both files import from.

## Scope

- `apps/api/src/routes/streaming.routes.ts` line 89 — current definition site.
- `apps/api/src/db/seeds/seed-channels.ts` — duplicates the same constant.
- Extraction target: `packages/shared/src/streaming.ts` if it fits the shared package's scope (consumed by both API and potentially web), otherwise `apps/api/src/services/channels.ts`. Prefer the shared package if the constant could also be useful client-side; prefer the service file if it's API-internal only.

## Tasks

- [ ] Determine whether `PLAYOUT_STREAM_NAMES` is API-internal or genuinely shared; pick the extraction target accordingly.
- [ ] Extract the constant to the chosen location.
- [ ] Update both `streaming.routes.ts` and `seed-channels.ts` to import from the new location.
- [ ] Run `bun --cwd=./platform run typecheck` and the unit suite to confirm no regressions.

## Notes

The constant is small (likely an array of string literals). The main decision is placement — shared vs. API-internal. If in doubt, start with `apps/api/src/services/channels.ts` to keep it API-scoped; it can be promoted to the shared package later if a web consumer emerges.
