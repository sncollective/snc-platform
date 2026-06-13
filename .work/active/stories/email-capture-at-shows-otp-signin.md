---
id: email-capture-at-shows-otp-signin
kind: story
stage: implementing
tags: [community]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: email-capture-at-shows
---

# Email-OTP passwordless sign-in

Unit 3 of the parent feature design (`email-capture-at-shows`).

## Scope

Extend the existing `emailOTP` plugin block in `apps/api/src/auth/auth.ts`:

- Handle `type === "sign-in"` in `sendVerificationOTP` — "Your S/NC sign-in code" via the
  existing `sendEmail` (html + text, same error-logging shape as the `forget-password` branch).
- Set `disableSignUp: false` **explicitly** — OTP sign-in auto-creating the account is the
  load-bearing behavior for the join flow.
- Verify better-auth's built-in OTP rate limiting is active in production config; if not,
  note it in the item body for the security gate.

OTP-created users have no `name`; the join-flow web story collects it and calls
`authClient.updateUser({ name })` post-session — nothing to do here beyond not breaking that.

## Acceptance criteria

- [ ] `sign-in` OTP email sends through `sendEmail` (Mailpit-verifiable in dev)
- [ ] OTP sign-in with a new email creates a user with verified email; existing email signs
      in to the existing account
- [ ] `forget-password` OTP path unchanged (existing tests stay green)
- [ ] Unit tests for the new branch via `vi-doMock-dynamic-import`, asserting `sendEmail` payloads
