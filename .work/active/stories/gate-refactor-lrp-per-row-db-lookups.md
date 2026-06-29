---
id: gate-refactor-lrp-per-row-db-lookups
kind: story
stage: implementing
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
