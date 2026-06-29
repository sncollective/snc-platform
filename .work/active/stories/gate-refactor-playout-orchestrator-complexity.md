---
id: gate-refactor-playout-orchestrator-complexity
kind: story
stage: drafting
tags: [refactor, quality]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: refactor
created: 2026-06-29
updated: 2026-06-29
---

# Playout orchestrator factory has grown into a 1000+ line tangled service

## Source library
scan-quality — rule: Complexity / `complexity`

## Severity
Medium

## Findings-route
refactor (behavior-preserving if public surface unchanged)

## Location
`apps/api/src/services/playout-orchestrator.ts:180`

## Evidence
```ts
export const createPlayoutOrchestrator = (client: LiquidsoapClient) => {
  const logger = rootLogger.child({ service: "playout-orchestrator" });
  // ── Pool scope ──
```

## Remediation direction
Split cohesive internal sections into private helpers/modules while preserving the public orchestrator surface.
