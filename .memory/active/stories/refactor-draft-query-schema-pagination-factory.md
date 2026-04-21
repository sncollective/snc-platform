---
id: story-refactor-draft-query-schema-pagination-factory
kind: story
stage: implementing
tags: [refactor, quality, content]
release_binding: null
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

Replace the hand-rolled pagination fields in `DraftQuerySchema` with the `createPaginationQuery()` factory already used by `FeedQuerySchema` in the same file, making the two schemas consistent.

## Scope

- `packages/shared/src/content.ts` lines 87–96 — `DraftQuerySchema` currently duplicates `limit`/`offset`/`page` fields by hand. Refactor to `createPaginationQuery({ max: 50, default: 12 }).extend({ ...draftSpecificFields })` mirroring the `FeedQuerySchema` pattern. Preserve existing field constraints (max 50, default 12) so the runtime contract is unchanged.

## Tasks

- [ ] Replace `DraftQuerySchema` body with `createPaginationQuery({ max: 50, default: 12 }).extend({...})`, retaining any draft-specific filter fields (status, visibility, etc.) in the `.extend()` block.
- [ ] Confirm the inferred TypeScript type for `DraftQuerySchema` is unchanged from the consumer's perspective.
- [ ] Run `bun --cwd=./platform run --filter @snc/shared test:unit` (or the full suite) to verify no regressions.

## Notes

This is a pure structural refactor — no behavior change, no API contract change. If `createPaginationQuery` currently has different defaults or constraints than what `DraftQuerySchema` hand-rolls, surface the discrepancy before merging rather than silently changing the max/default values.
