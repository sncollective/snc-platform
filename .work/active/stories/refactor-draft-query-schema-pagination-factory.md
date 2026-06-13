---
id: refactor-draft-query-schema-pagination-factory
kind: story
stage: done
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

**Commit attribution (archaeology note).** This story's code (`content.ts`, `content.test.ts`, this file) landed in commit `93ba0f2`, whose message is `research-handoff: file 2 items from privacy-consent-compliance` — an *unrelated* concurrent lane's commit. Cause: pre-commit's stash/restore is shared mutable state, and during parallel-agent fan-out this refactor's unstaged work was folded into another agent's commit during the restore. The code is correct and complete; only the commit message is misleading. History was deliberately NOT rewritten to split it — `main` had multiple lanes committing on top of `93ba0f2` at the time, so the archaeological cost of the mislabel is far cheaper than the risk of history surgery on a shared branch. `git log -- packages/shared/src/content.ts` lands on `93ba0f2`; this note is the bridge. (Process lesson for parallel implement waves: serialize the commit step, or give each parallel writer worktree isolation, so the stash/restore cycle isn't shared.)

## Review (2026-06-13)
**Verdict**: Approve — fast-lane advance. Pure structural refactor, type structurally
identical, 675 shared + 1567 API tests pass. The lane's own commit-attribution note
(landed in 93ba0f2, a research-handoff commit, via the parallel-wave stash/restore
collision) is the correct disposition — code correct, no history surgery on the shared
branch, archaeology bridge recorded. Same root cause as the streaming-lifecycle mislabel:
parallel implement waves share pre-commit's stash/restore.
