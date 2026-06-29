---
id: gate2-tests-stale-policyversion-rejection
kind: story
stage: done
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

## Implementation (2026-06-29)
- Added shared `CompleteJoinRequestSchema` coverage proving only `PRIVACY_POLICY_VERSION` is accepted and stale values fail on `policyVersion`.
- Added POST `/api/join/:creatorId/complete` route coverage for a stale policy version returning 400 without calling `completeJoin`.
- Verification not run per operator instruction (`bun` unavailable in this sub-agent harness).

## Review (2026-06-29)

**Verdict**: Approve. Fast-lane (gate-rerun-1 finding, green verification — full suite: shared + api 116 + web build/test). No blockers above nit.
