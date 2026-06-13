---
id: refactor-draft-query-schema-pagination-factory
kind: story
stage: review
tags: [refactor, quality, content]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-04-20
updated: 2026-06-13
parent: null
---

Replace the hand-rolled pagination fields in `DraftQuerySchema` with the `createPaginationQuery()` factory already used by `FeedQuerySchema` in the same file, making the two schemas consistent.

## Scope

- `packages/shared/src/content.ts` lines 87–96 — `DraftQuerySchema` currently duplicates `limit`/`offset`/`page` fields by hand. Refactor to `createPaginationQuery({ max: 50, default: 12 }).extend({ ...draftSpecificFields })` mirroring the `FeedQuerySchema` pattern. Preserve existing field constraints (max 50, default 12) so the runtime contract is unchanged.

## Tasks

- [x] Replace `DraftQuerySchema` body with `createPaginationQuery({ max: 50, default: 12 }).extend({...})`, retaining any draft-specific filter fields (status, visibility, etc.) in the `.extend()` block.
- [x] Confirm the inferred TypeScript type for `DraftQuerySchema` is unchanged from the consumer's perspective.
- [x] Run `bun --cwd=./platform run --filter @snc/shared test:unit` (or the full suite) to verify no regressions.

## Notes

This is a pure structural refactor — no behavior change, no API contract change. If `createPaginationQuery` currently has different defaults or constraints than what `DraftQuerySchema` hand-rolls, surface the discrepancy before merging rather than silently changing the max/default values.

## Implementation notes

**Contract preservation confirmed.** The hand-rolled schema used `z.string().optional().transform(parseInt).pipe(z.number().int().min(1).max(50))` with a conditional default of 12. The factory uses `z.coerce.number().int().min(1).max(50).default(12)`. Both coerce string query params to numbers with identical bounds (min 1, max 50, default 12); `z.coerce.number()` is the canonical form for this pattern — the hand-rolled transform was imitating it. The `cursor` field is produced by the factory and did not need to be in `.extend()`. The `type` field (ContentTypeSchema.optional()) and `creatorId` (z.string().min(1)) are the only draft-specific fields and were moved to `.extend({})`.

**TypeScript type unchanged.** `tsc --noEmit` passed with zero errors. The inferred `DraftQuery` type (`{ creatorId: string; type?: "video" | "audio" | "written"; cursor?: string; limit: number }`) is structurally identical from the consumer's perspective — `limit` was always a `number` after parsing in both forms.

**Tests:** 675 shared tests pass (all pre-existing + 4 new assertions in `DraftQuerySchema` describe block covering: type filter acceptance, invalid type rejection, all-fields-together parse, empty-query default output). 1567 API unit tests pass — no consumer breakage.
