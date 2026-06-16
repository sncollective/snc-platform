---
id: email-capture-at-shows-join-flow-web
kind: story
stage: review
tags: [community, commerce]
release_binding: null
depends_on: [email-capture-at-shows-join-api, email-capture-at-shows-otp-signin]
gate_origin: null
created: 2026-06-13
updated: 2026-06-16
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

## Implementation (2026-06-16)
Units 4+6. Public route routes/join/$handle.tsx (loader → GET /api/join/:handleOrId,
no auth redirect) + join.module.css; the wizard: capture (name/email/consent+incentive)
→ code (OTP → signIn.emailOtp → updateUser{name} → POST /complete) → welcome (band-voiced
recap + incentive callout) → preferences (PUT /api/me/notifications for go_live/new_content
before any contact) → explainer+CTA (config-gated, platform-voiced, creatorPlans → useCheckout,
'Done/maybe later'). Authed visitors short-circuit to one-tap follow. Failure UX preserves
input. routes/privacy.tsx (Unit 6) — operator-supplied placeholder, wires PRIVACY_POLICY_VERSION.

4 wizard tests (anonymous happy path w/ single-OTP assertion, consent-gating, authed
short-circuit, both-flags-off skip). web 1753/1753, tsc clean. Live: /join/maya-chen → 200
(band header + capture form render), /privacy → 200. join-flow-web → review.
