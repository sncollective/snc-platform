---
id: gate-tests-join-follow-consent-persistence
kind: story
stage: review
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

## Implementation (2026-06-29)
- Added `apps/api/tests/services/join.test.ts` covering `completeJoin` happy-path persistence: creator resolution, `followCreator` call, and `consent_log` insert shape (`userId`, `consentType`, `policyVersion`, `source: join:<creatorId>`).
- Added a guard test that consent is not appended when following the creator fails.
- Verification: `bun run --filter @snc/api test:unit -- tests/services/join.test.ts` passed.
- Adjacent issues parked: none.
