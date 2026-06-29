---
id: gate-security-no-email-verification-required
kind: story
stage: drafting
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
