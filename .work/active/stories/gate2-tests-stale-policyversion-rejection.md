---
id: gate2-tests-stale-policyversion-rejection
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

# Stale/wrong join policyVersion rejection is not covered

## Priority
High

## Spec reference
Item: `gate-tests-join-policyversion-contract` / `email-capture-at-shows-join-api`
Acceptance criterion: client-attested policyVersion — a stale/wrong value must 400 and not completeJoin.

## Suggested test
`apps/api/tests/routes/join.routes.test.ts` + `packages/shared/tests/join.test.ts` — POST /complete with stale policyVersion → 400, completeJoin not called.
