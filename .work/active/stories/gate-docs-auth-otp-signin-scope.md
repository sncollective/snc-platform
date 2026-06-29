---
id: gate-docs-auth-otp-signin-scope
kind: story
stage: review
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

## Implementation (2026-06-29)
- Updated `docs/auth.md` to describe email OTP as covering both password resets and sign-in codes.
- Documented the load-bearing `emailOTP({ disableSignUp: false })` behavior: sign-in OTP verification can create an account for anonymous email-capture flows.
- Grounded the capture-flow description in current call sites: creator join pages and live-page notify-me send `type: "sign-in"` OTPs and then call `signIn.emailOtp()` before recording consent/subscription actions.
- Verification: documentation-only change; checked against `apps/api/src/auth/auth.ts`, `apps/web/src/routes/join/$handle.tsx`, and `apps/web/src/components/live/notify-me-form.tsx`.
