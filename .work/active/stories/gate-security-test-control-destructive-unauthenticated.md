---
id: gate-security-test-control-destructive-unauthenticated
kind: story
stage: drafting
tags: [security]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: security
created: 2026-06-29
updated: 2026-06-29
---

# E2E test-control routes are destructive and unauthenticated when mounted

## Severity
Medium

## Domain
API Security

## Location
`apps/api/src/routes/test-control.routes.ts:44`

## Evidence
```ts
testControlRoutes.post(
  "/creator-programming/maya/reset",
  describeRoute({
    description: "Reset Maya creator-programming mutable demo state for e2e setup.",
```

## Remediation direction
Keep the production mount gate, but also require a test-control shared secret/header or loopback-only enforcement so profile misconfiguration does not expose DB reset/seed actions.
