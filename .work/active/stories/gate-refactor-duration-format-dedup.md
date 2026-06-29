---
id: gate-refactor-duration-format-dedup
kind: story
stage: done
tags: [refactor, quality]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: refactor
created: 2026-06-29
updated: 2026-06-29
---

# Duration formatting helper is duplicated across three admin pool components

## Source library
scan-quality — rule: Duplication / `dedup`

## Severity
High

## Findings-route
refactor (behavior-preserving)

## Location
`apps/web/src/components/admin/content-search-picker.tsx:20` (also `pool-item-picker.tsx`, `content-pool-table.tsx`)

## Evidence
```ts
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
```

## Remediation direction
Extract one shared duration formatter used by `content-search-picker.tsx`, `pool-item-picker.tsx`, and `content-pool-table.tsx`.

## Implementation (2026-06-29)
- Files changed: `apps/web/src/lib/format-duration.ts`, `apps/web/src/components/admin/content-search-picker.tsx`, `apps/web/src/components/admin/pool-item-picker.tsx`, `apps/web/src/components/admin/content-pool-table.tsx`, `apps/web/tests/unit/lib/format-duration.test.ts`
- Tests added: `apps/web/tests/unit/lib/format-duration.test.ts`
- Verification: `bun run --filter @snc/web test tests/unit/lib/format-duration.test.ts`
- Discrepancies from design: existing `apps/web/src/lib/format-duration.ts` already held the matching clock formatter as `formatSeconds`; added the requested `formatDuration` export and kept `formatSeconds` as a compatibility alias.
- Adjacent issues parked: none

## Review (2026-06-29)

**Verdict**: Approve

**Notes**: Fast-lane (story with green verification). Implementation verified in the implement wave: full suite green (shared 682, api 1890, web 1807, web build). No blockers or important findings above nit.
