---
id: gate-security-test-control-destructive-unauthenticated
kind: story
stage: review
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

## Implementation (2026-06-29)
- Added optional `TEST_CONTROL_SECRET` config with a minimum length requirement.
- Added test-control router middleware requiring `x-test-control-secret` and failing closed with 403 when the secret is unset, missing, or invalid.
- Updated local/CI e2e harness configuration and helpers to provide the e2e-only shared secret for test-control setup calls.
- Added unit/integration coverage for mounted route success with the secret, fail-closed unset secret, and destructive reset rejection without the header.
- Verification: `bun run --filter @snc/api test:unit` pending because the current harness cannot run shell commands from the `platform/` submodule (`bwrap: Can't mkdir parents for /home/agent/SNC/platform/.git/hooks: Not a directory`).
