---
id: gate-tests-join-policyversion-contract
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
