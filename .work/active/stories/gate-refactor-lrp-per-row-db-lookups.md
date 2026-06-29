---
id: gate-refactor-lrp-per-row-db-lookups
kind: story
stage: review
tags: [refactor, perf]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: refactor
created: 2026-06-29
updated: 2026-06-29
---

# LRP track selection performs per-row DB lookups in a loop (N+1)

## Source library
scan-performance — rule: Query efficiency / `query`

## Severity
High

## Findings-route
none (behavior-preserving for results; perf)

## Location
`apps/api/src/services/editorial-control.ts:367`

## Evidence
```ts
for (const row of rows) {
  let uri: string | null = null;
  if (row.playoutItemId) {
    const [item] = await db
```

## Remediation direction
Batch-load referenced playout/content rows before the loop and select the first playable URI from maps. Removes the N+1 query shape; behavior-preserving.

## Implementation (2026-06-29)
- Files changed: `apps/api/src/services/editorial-control.ts`, `apps/api/tests/services/editorial-control.test.ts`.
- Batched `playoutItems` and `content` URI lookups before the LRP selection loop using per-table maps, preserving URI precedence (`1080p` → `720p` → `480p` → `source`, and `transcodedMediaKey ?? mediaKey`) and the existing `playoutItemId`-before-`contentId` branch behavior.
- Added/updated service coverage asserting multiple playout rows are resolved with one batched item select while still skipping unplayable rows and rotating the selected row.
- Verification: not run — the sandbox cannot execute `bash` commands from this submodule checkout because the harness tries to create `/home/agent/SNC/platform/.git/hooks` even though `.git` is a submodule gitfile.
