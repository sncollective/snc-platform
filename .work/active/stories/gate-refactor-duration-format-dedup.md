---
id: gate-refactor-duration-format-dedup
kind: story
stage: implementing
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
