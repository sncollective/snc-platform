---
id: email-capture-at-shows-join-flow-web
kind: story
stage: implementing
tags: [community, commerce]
release_binding: null
depends_on: [email-capture-at-shows-join-api, email-capture-at-shows-otp-signin]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: email-capture-at-shows
---

# Public join flow (web wizard) + /privacy placeholder

Units 4 + 6 of the parent feature design (read `## Implementation Units` in
`email-capture-at-shows` for the full step spec, settled flow order, and tone constraint).

## Scope

- `apps/web/src/routes/join/$handle.tsx` + `join.module.css`; step components under
  `apps/web/src/components/join/`. Public route (no auth redirect); `loader` fetches
  `GET /api/join/:handleOrId`.
- Wizard: **capture** (name/email/consent + incentive line) → **code** (OTP →
  `signIn.emailOtp` → `updateUser({name})` → `POST /api/join/:creatorId/complete`) →
  **you're in** (band-voiced recap + incentive callout) → **preferences** (existing
  notification-prefs API, before any further contact) → **S/NC explainer + subscribe CTA**
  (skippable, config-gated, platform-voiced, tier cards → `useCheckout`).
- Authed-visitor short-circuit: one-tap follow + consent confirm.
- Failure UX: retries with input preserved (settled online-only posture).
- `apps/web/src/routes/privacy.tsx` — placeholder policy route; text clearly marked
  operator-supplied; wire `PRIVACY_POLICY_VERSION`.

## Acceptance criteria

- [ ] Full wizard happy path tested with mocked `authClient` + fetch (`vi-hoisted-module-mock`)
- [ ] Consent unchecked → cannot request OTP
- [ ] Steps respect config flags (explainer/CTA hidden when off; both off = clean band-only flow)
- [ ] Authed-visitor short-circuit works
- [ ] No outbound email triggered by the flow other than the OTP
- [ ] Mobile-first; design tokens only; dependency-light page load
