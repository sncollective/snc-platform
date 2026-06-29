---
id: gate-cruft-unused-determinism-exports
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

# E2E determinism helper exports unused fixture-time variants

## Severity
Low

## Debris type
dead-code

## Location
`apps/e2e/tests/helpers/determinism.ts:75`

## Evidence
```ts
export const testSeededSuffix = (
  testInfo: TestInfo,
  ...parts: readonly string[]
): string => seededSuffix([...testInfoSeedParts(testInfo), ...parts]);
```

## Why it's debris (verified)
`git grep -n -w testSeededSuffix` and `git grep -n -w fixedFixtureDate`: `testSeededSuffix` is only documented plus self-referenced, and `fixedFixtureDate` has no callers beyond its definition.

## Remediation direction
Drop the unused exports, or add tests/specs that actually use these helper variants if they are part of the intended e2e convention.
