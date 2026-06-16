---
date: 2026-06-16
tags: [community, commerce, email-capture, otp, epic-close]
session_type: feature build → review → close (email-capture-at-shows done)
related_items:
  - email-capture-at-shows
---

# Session: email-capture-at-shows complete (build → review → archive)

Picked up the natural next thread after live-experience-redesign: finishing
`email-capture-at-shows` — the band-show email-capture → follower → subscribe funnel.
The OTP-signin groundwork was already laid (built last session for notify-me), so this
session built the remaining 3 stories and closed the feature.

## What was already done (de-risked the build)

From the notify-me work: `sendOtpEmail` (the OTP-signin extension, story already at review),
the `consentLog` table, and `PRIVACY_POLICY_VERSION`. So `join-api` only needed the
`creatorJoinConfigs` half + the service/routes.

## Built this session

- **join-api** (Units 1+2): `creatorJoinConfigs` table (migration 0028); shared join types
  (`packages/shared/src/join.ts`); `services/join.ts` (`getJoinPagePayload`, `completeJoin`
  reusing `followCreator` + consentLog, `get`/`updateJoinConfig` upsert); routes — public
  `GET /api/join/:handleOrId` (rateLimiter, dual-mode handle/id), `POST /:creatorId/complete`
  (requireAuth, consent:literal-true), `GET/PATCH /api/creators/:creatorId/join-config`
  (editProfile permission).
- **join-flow-web** (Units 4+6): the public `/join/$handle` multi-step wizard (capture → OTP
  code → welcome → preferences → config-gated S/NC explainer+subscribe CTA), authed-visitor
  one-tap short-circuit, and a `/privacy` placeholder route.
- **creator-qr-settings** (Unit 5): a "Join page" creator-manage tab — join URL + copy,
  client-side SVG QR (`qrcode` npm — new web dep), print-poster stylesheet, config form.

## Adversarial review caught a real blocker

The review found a **blocker** I'd have shipped: the join wizard seeded `step` from
`isLoggedIn` in `useState`, but `useSession()` starts null/pending on the client and resolves
AFTER mount (no SSR session priming). So a logged-in fan got `step:'capture'` baked in, the
session flipped logged-in, every render guard failed → **blank dead-end page**. My own
join-flow test missed it because it mocked the session as logged-in synchronously from first
render. **Fixed**: derive the entry branch live during render (mirroring the proven
`notify-me-form.tsx`), never seed it into `useState`; `step` now tracks only in-flow
progression. The same fix structurally resolves the OTP-retry trap (a post-sign-in failure
now lands the logged-in user on the one-tap path). Regression test added that reproduces the
exact bug (pending → resolves-logged-in → one-tap, no dead-end).

**Lesson**: a test that mocks an async hook (`useSession`) as resolved-synchronously hides
post-mount-resolution bugs. The render-derived pattern (`notify-me-form`) is the house-correct
way; seeding step/branch from an async-hook value into `useState` is the trap.

## Close

All 4 stories done → feature Approve → done. Feature + 4 stories archived as bodyless stubs
(delete-refs, archived_atop 0.3.0). The API/service/schema/manage layers reviewed clean
(authz on complete + join-config, no public-payload leak, consent enforced, upsert correct).

## Verification

shared 675 / api 1635 / web 1757 unit; tsc clean across packages; migrations 0026/0027/0028
applied; prod web build OK (qrcode bundles); live-stack: GET /api/join/maya-chen → 200 with
config defaults, POST /complete unauth → 401, /join + /privacy render.

## Resume map

- email-capture-at-shows: DONE + archived. CSV-import (paper sheets) was deliberately
  deferred to a follow-up story (needs the lead-record shape v1 avoided) — not spawned.
- Deferred connections still in backlog: `community-unsubscribe-link-emails`,
  `community-subscription-lifecycle-emails` (the post-capture funnel emails, gated on the
  preferences captured here).
- Other in-flight epics: `unified-channel-model` (editorial-engine next),
  `playout-admin-redesign` (live-data — can reuse the SpineProvider). The bold-* epics remain
  design-gated.
- 3 done-but-held stories still await user fix-verify (failed-upload, on-forward, systemd).
