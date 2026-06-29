---
id: gate-cruft-dead-nowplaying-wrapper
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

# Dead S/NC TV now-playing compatibility wrapper is kept alive only by tests

## Severity
Medium

## Debris type
dead-code

## Location
`apps/api/src/services/playout.ts:169`

## Evidence
```ts
export const getPlayoutNowPlaying = async (
  srsStreamName?: string,
): Promise<NowPlaying | null> => {
  void srsStreamName; // No longer used for routing — kept for signature compatibility
```

## Why it's debris (verified)
`git grep -n -w getPlayoutNowPlaying -- apps/api/src apps/web/src packages/shared/src scripts`: the only runtime hit is this definition. Remaining hits are unit tests and a backlog note. The wrapper also preserves an ignored compatibility parameter.

## Remediation direction
Remove the wrapper and its dedicated tests, or wire it to a real runtime caller if this endpoint shape is still intended.

## Implementation (2026-06-29)

Removed the dead `getPlayoutNowPlaying` compatibility wrapper from `apps/api/src/services/playout.ts`, removed its now-exclusive Liquidsoap service mock wiring and dedicated unit tests from `apps/api/tests/services/playout.test.ts`, and verified no production importers remain by searching runtime paths.
