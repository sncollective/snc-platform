---
id: gate-tests-join-policyversion-contract
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

# Join completion does not test the required `policyVersion` request contract

## Priority
High

## Spec reference
Item: `email-capture-at-shows-join-api`
Acceptance criterion: "`POST /api/join/:creatorId/complete` — `requireAuth`, body `{ consent: true, policyVersion }`"

## Gap type
missing test for error case

## Suggested test
```ts
it("rejects complete without policyVersion and does not call completeJoin", async () => {
  const res = await json("POST", "/api/join/c1/complete", { consent: true });
  expect(res.status).toBe(400);
  expect(mockCompleteJoin).not.toHaveBeenCalled();
});
```

## Test location (suggested)
`apps/api/tests/routes/join.routes.test.ts`

## Implementation (2026-06-29)
- Updated the shared `CompleteJoinRequestSchema` so join completion requires the current `policyVersion` alongside explicit `consent: true`.
- Updated the API route to pass the validated policy version to `completeJoin`, and updated the join page client call/tests to send the shared canonical `PRIVACY_POLICY_VERSION`.
- Added route coverage for missing `policyVersion`: the validator returns the exact `hono-openapi` 400 shape (`{ success: false, error: [...] }`) and `completeJoin` is not called.
- Verification: `bun run --filter @snc/api test:unit -- tests/routes/join.routes.test.ts` passed; `bun run --filter @snc/web test -- tests/unit/routes/join-flow.test.tsx` passed.
- Adjacent issues parked: none.

## Review (2026-06-29)

**Verdict**: Approve

**Notes**: Fast-lane (story with green verification). Implementation verified in the implement wave: full suite green (shared 682, api 1890, web 1807, web build). No blockers or important findings above nit.
