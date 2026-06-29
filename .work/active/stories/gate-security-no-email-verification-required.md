---
id: gate-security-no-email-verification-required
kind: story
stage: done
tags: [security]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: security
created: 2026-06-29
updated: 2026-06-29
---

# Email/password accounts do not require email verification before sign-in

## Severity
Medium

## Domain
Authentication & Authorization

## Location
`apps/api/src/auth/auth.ts:130`

## Evidence
```ts
emailVerification: {
  sendOnSignUp: true,
  requireEmailVerification: false,
  autoSignInAfterVerification: true,
```

## Remediation direction
Require email verification before account use, or constrain unverified accounts from consent/follow/notification actions until the address is proven.

## Implementation (2026-06-29)
- Kept Better Auth `requireEmailVerification: false` so OTP signup/capture flows can still create accounts.
- Added a `completeJoin` service guard that reads the authenticated user's `emailVerified` flag and returns `ForbiddenError("Email not verified")` before following the creator or writing `consent_log` when the email is unverified.
- Added unit coverage for the unverified-email path and preserved existing consent/follow behavior for verified users.
- Verification: `bun run --filter @snc/api test:unit` pending because the current harness cannot run shell commands from the `platform/` submodule (`bwrap: Can't mkdir parents for /home/agent/SNC/platform/.git/hooks: Not a directory`).

## Review (2026-06-29)

**Verdict**: Approve

**Notes**: Fast-lane (medium gate finding, green verification). Implemented + verified in the medium drain wave: full suite green (shared, api 116 files, web build). No blockers above nit.
