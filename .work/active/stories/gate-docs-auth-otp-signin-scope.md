---
id: gate-docs-auth-otp-signin-scope
kind: story
stage: drafting
tags: [documentation]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: docs
created: 2026-06-29
updated: 2026-06-29
---

# Auth docs describe email OTP as password-reset-only, but sign-in OTP now auto-creates capture-flow accounts

## Severity
Medium

## Drift type
foundation-doc

## Location
`docs/auth.md:9,129,150`; contradicting: `apps/api/src/auth/auth.ts:54,63,177,180`

## Evidence
The auth doc says email OTP is "for password resets" and SMTP is for verification/password reset emails. The code defines OTP copy for `"sign-in"` and configures `emailOTP({ disableSignUp: false })`, explicitly for email-capture / notify-me capture flows.

## Remediation direction
Update auth docs to cover sign-in OTP, auto-signup behavior, and its role in capture flows, while retaining password-reset coverage.
