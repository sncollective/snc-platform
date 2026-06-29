---
id: gate2-tests-testcontrol-wrong-secret
kind: story
stage: implementing
tags: [testing]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: tests
created: 2026-06-29
updated: 2026-06-29
---

# Test-control shared-secret gate lacks wrong-secret coverage

## Priority
High

## Spec reference
Item: `gate-security-test-control-destructive-unauthenticated`
Acceptance criterion: wrong/missing x-test-control-secret → 403.

## Suggested test
`apps/api/tests/integration/test-control-gating.test.ts` — mounted e2e profile + wrong secret → 403.
