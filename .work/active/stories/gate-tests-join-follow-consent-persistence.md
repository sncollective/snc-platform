---
id: gate-tests-join-follow-consent-persistence
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

# Join API lacks service-level tests for follow + consent persistence

## Priority
Critical

## Spec reference
Item: `email-capture-at-shows-join-api`
Acceptance criterion: "Happy-path + auth-failure tests per route; service tests with `drizzle-chainable-mock`"

## Gap type
missing test for valid partition

## Suggested test
```ts
it("completeJoin follows the creator and appends an email-contact consent record", async () => {
  // Mock/chain DB + followCreator.
  // Call completeJoin(userId, creatorId, policyVersion).
  // Assert followCreator called and consent_log insert includes userId, source join:<creatorId>, policyVersion.
});
```

## Test location (suggested)
`apps/api/tests/services/join.test.ts`
