---
date: 2026-06-15
tags: [streaming, community, notifications, epic-close, live-experience-redesign]
session_type: notify-me build → review → epic close (live-experience-redesign done)
related_items:
  - live-experience-redesign
  - live-experience-redesign-notify-me
  - email-capture-at-shows-otp-signin
---

# Session: notify-me build → epic close (live-experience-redesign done)

Final stretch of the live-experience-redesign epic — built the last feature (notify-me),
reviewed it adversarially, fixed the bug it found, and closed + archived the whole epic.
Continued from the live-state server/client work earlier the same day.

## notify-me — the offline-page conversion loop

**Grounded before designing.** A substrate scan found the EXISTING go-live notification
system (per-creator, SRS-`on_publish`-triggered, `notification-dispatch.ts` → pg-boss →
`sendEmail`). So notify-me REUSED the dispatch/email/job infra rather than rebuilding —
the genuinely new pieces shrank to: per-channel subscription, a channel-go-live dispatch
path, the offline capture UI.

**User decisions** (surfaced because they were real forks, not defaults):
- **OTP-signup capture** (match `email-capture-at-shows`) — captured email becomes a real
  user via better-auth email-OTP, so NO anonymous-subscriber table / token-unsubscribe.
- **Per-channel** subscription — works for the ownerless S/NC TV broadcast AND creator
  channels; fires off `channel.live-state-changed`.

**Cross-feature coordination, done by ownership.** notify-me needed two pieces OWNED by the
in-flight `email-capture-at-shows`: the OTP-signin extension (`type:'sign-in'` +
`disableSignUp:false`) and the `consentLog` table. Per the user's call, landed those in
email-capture's territory first (extracted a testable `sendOtpEmail` helper; `consentLog`
table + migration 0026) — both features converge on the shared pieces instead of
duplicating. `email-capture-at-shows-otp-signin` → review as a result.

**Built across the stack:** `channel_notify_subscriptions` (migration 0027), `channel_go_live`
event + email template, `POST /api/notify-when-live` (OTP-capture, consent-required),
`dispatchChannelGoLive` with a per-channel cooldown debounce wired to all 3 go-live seams,
and the offline-page `NotifyMeForm` (logged-in one-click / anonymous OTP flow).

## Adversarial review caught a real bug

A fresh-context reviewer found **1 important correctness bug**: `dispatchChannelGoLive` set
the cooldown timestamp BEFORE the channel lookup + dispatch loop — so an unknown channel or
a DB/boss throw burned the cooldown, silently suppressing a GENUINE go-live for the next 10
minutes (exactly what the feature exists to deliver). **Fixed**: arm the cooldown only after
a successful dispatch pass; test added proving an unknown channel doesn't consume it. Plus 2
nits fixed (OTP-then-subscribe error swallowing; a dead `policyVersion` body field). This is
the value of the adversarial pass — the bug would have shipped silently.

## Epic close

All 4 features done (layout-ergonomics, page-states, live-state, notify-me) → epic rolled up
→ Approve → **done**. Epic + 4 features + 6 stories + the SSE-client research feature
archived as **bodyless stubs** (delete-refs, `archived_atop: 0.3.0`, bodies at `git_ref
fbd1915`, late-bindable into a future release). De-linked the 4 now-archived refactor-*
features in `refactor-scan-2026-04-24-findings.md` (durable→archived links rot).

## Verification baselines (held throughout)

shared 675 / api 1626 / web 1749 unit; tsc clean across all 3 packages; migrations 0026 +
0027 applied to dev DB via drizzle-kit; live-stack: subscribe persists (real API), route
auth-guarded, dispatch wired to a registered worker. (The secret-gated input-switch webhook
was the one piece not fired live — an auth boundary, not a gap; dispatch logic is
unit-verified incl. the debounce.)

## Process notes

- Two transient Anthropic-side API errors interrupted wrap-up turns (NOT the platform —
  confirmed healthy each time via pm2/logs). Re-confirmed clean state and resumed. The
  pattern: an "API error" alert is the Claude side unless the platform logs say otherwise.
- Landing work across feature boundaries (email-capture's OTP/consent for notify-me) is fine
  when ownership is respected and noted in BOTH items so they converge, not duplicate.

## Resume map

- **live-experience-redesign epic: DONE + archived.** A whole viewer-facing redesign shipped
  (honest live-state, SSE live updates, mobile restructure, notify-me conversion loop).
- `email-capture-at-shows`: its `otp-signin` story is now at review (built here); the rest of
  that feature (join-api, join-flow-web, creator-qr-settings) remains at implementing — a
  natural next pickup, and the OTP + consentLog groundwork is already laid.
- Reusable `<SpineProvider>` now exists; `playout-admin-redesign-live-data` (spine-dependent)
  can reuse it next.
- 3 done-but-held stories still await user fix-verify (failed-upload, on-forward, systemd).
