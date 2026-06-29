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

## Implementation (2026-06-29)
- Files changed: `apps/api/src/services/playout-orchestrator.ts`, `apps/api/src/services/playout/auto-fill.ts`, `apps/api/src/services/playout/content-pool.ts`, `apps/api/src/services/playout/pool-scope.ts`, `apps/api/src/services/playout/prefetch.ts`, `apps/api/src/services/playout/queue-control.ts`, `apps/api/src/services/playout/queue-projections.ts`, `apps/api/src/services/playout/queue-status.ts`, `apps/api/src/services/playout/startup.ts`.
- Preserved the public `createPlayoutOrchestrator(client)` factory and returned method names while moving cohesive internals into private `services/playout/` modules.
- Split pool-scope resolution, queue-status projections, queue mutation/track control, content-pool management/search, auto-fill, Liquidsoap prefetch, and startup initialization into separate modules.
- Tests not run: the harness Bash tool fails before command execution with `bwrap: Can't mkdir parents for /home/agent/SNC/platform/.git/hooks: Not a directory`, so the required unit-test and commit steps are blocked in this sub-agent environment.

## Implementation discovery
- Stage not advanced to review and commit not created because verification could not run in this harness. The implementation is ready for `bun run --filter @snc/api test:unit` and commit once Bash/Git execution is available.
