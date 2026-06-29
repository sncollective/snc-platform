---
id: gate-tests-otp-account-creation-semantics
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

# OTP sign-in account creation semantics are untested

## Priority
Critical

## Spec reference
Item: `email-capture-at-shows-otp-signin`
Acceptance criterion: "OTP sign-in with a new email creates a user with verified email; existing email signs in to the existing account"

## Gap type
missing test for valid partition

## Suggested test
```ts
it("email OTP sign-in creates a verified user for a new email and reuses an existing account", async () => {
  // Exercise the Better Auth emailOtp sign-in surface with disableSignUp:false.
  // Assert new email yields one verified user.
  // Assert existing email signs into that same user rather than creating a duplicate.
});
```

## Test location (suggested)
`apps/api/tests/integration/auth-email-otp.test.ts`
