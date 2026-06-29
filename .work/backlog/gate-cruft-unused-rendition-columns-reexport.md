---
id: gate-cruft-unused-rendition-columns-reexport
kind: story
stage: backlog
tags: [cleanup]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: cruft
created: 2026-06-29
updated: 2026-06-29
---

# Unused `RENDITION_COLUMNS` backwards-compatibility re-export

## Severity
Low

## Debris type
compat-shim

## Location
`apps/api/src/services/playout.ts:158`

## Evidence
```ts
// Re-export for backwards compatibility with existing callers (ingest handler, etc.)
export { RENDITION_COLUMNS_FROM_UTILS as RENDITION_COLUMNS };
```

## Why it's debris (verified)
`git grep -n -w RENDITION_COLUMNS`: no callers import this compatibility re-export; hits are only the source constant in `playout-utils.ts`, the import alias, and this re-export.

## Remediation direction
Delete the compatibility re-export and import alias from `playout.ts`.
