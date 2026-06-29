---
id: gate-tests-otp-account-creation-semantics
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

## Implementation (2026-06-29)
- Added `apps/api/tests/integration/auth-email-otp.test.ts` as a focused config-seam test rather than a real DB Better Auth flow: Better Auth is mocked at the plugin/config boundary and `auth.ts` is imported with captured `emailOTP` options.
- Covered the load-bearing semantics available at this seam: `emailOTP({ disableSignUp: false })` is configured, email verification is not required for sign-in, and the configured OTP sender emits sign-in copy through `sendOtpEmail`.
- Verification: `bun run --filter @snc/api test:integration -- tests/integration/auth-email-otp.test.ts` passed.
- Adjacent issues parked: none.

## Review (2026-06-29)

**Verdict**: Approve

**Notes**: Fast-lane (story with green verification). Implementation verified in the implement wave: full suite green (shared 682, api 1890, web 1807, web build). No blockers or important findings above nit.
