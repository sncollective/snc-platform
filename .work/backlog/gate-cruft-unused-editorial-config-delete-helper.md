---
id: gate-cruft-unused-editorial-config-delete-helper
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

# Unused editorial config delete helper

## Severity
Low

## Debris type
dead-code

## Location
`apps/api/src/services/editorial-config.ts:369`

## Evidence
```ts
export const deleteEditorialConfig = async (
  channelId: string,
): Promise<Result<void>> => {
```

## Why it's debris (verified)
`git grep -n -w deleteEditorialConfig -- apps/api/src apps/web/src packages/shared/src scripts`: no production caller exists; only the definition is present.

## Remediation direction
Remove it, or expose a deliberate operator/admin path that uses it.
