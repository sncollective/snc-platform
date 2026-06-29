---
id: gate-cruft-dead-editorial-structural-edit-helpers
kind: story
stage: review
tags: [cleanup]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: cruft
created: 2026-06-29
updated: 2026-06-29
---

# Editorial structural-edit helpers have no production callers

## Severity
Medium

## Debris type
dead-code

## Location
`apps/api/src/services/editorial-control.ts:230`

## Evidence
```ts
export const setTierEnabled = async (
  tierId: string,
  enabled: boolean,
): Promise<Result<void, AppError>> => {
```

## Why it's debris (verified)
`git grep` across runtime paths (`apps/api/src`, `apps/web/src`, `packages/shared/src`, `scripts`) for `setTierEnabled`, `setTierPriority`, `addCarryEdge`, `removeTier`: each appears only at its own definition. The exported structural-edit surface is tested but not routed or consumed.

## Remediation direction
Remove the unused helper surface until routes/UI exist, or add the missing route/API layer if these mutations are intended for release.

## Implementation (2026-06-29)

Removed the unused structural-edit helper exports (`setTierEnabled`, `setTierPriority`, `addCarryEdge`, and `removeTier`) from `apps/api/src/services/editorial-control.ts`, removed their exclusive unit tests and dead mocks from `apps/api/tests/services/editorial-control.test.ts`, and verified no production importers remain by searching runtime paths.
