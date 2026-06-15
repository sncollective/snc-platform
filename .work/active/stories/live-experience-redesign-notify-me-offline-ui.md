---
id: live-experience-redesign-notify-me-offline-ui
kind: story
stage: done
tags: [streaming, community]
release_binding: null
depends_on: [live-experience-redesign-notify-me-subscribe-api]
gate_origin: null
created: 2026-06-15
updated: 2026-06-15
parent: live-experience-redesign-notify-me
---

# Offline-page notify-me capture UI

Unit 4 of the parent design — the conversion affordance on the `/live` offline surface.

## Units

- **`live.tsx` `OfflinePlaceholder`** (currently calendar-link only, `:543`) + a `NotifyMeForm`
  component: email input + consent checkbox + submit → `POST /api/notify-when-live`, then the
  OTP verify step. Logged-in users get one-click subscribe (skip email entry). Keep the
  existing calendar link.
- **Channel target**: the offline page has no airing channel to pick. Default to the S/NC TV
  broadcast channel ("notify me when S/NC TV is live") — the always-present anchor. A picker of
  known channels is the fuller answer; start with the broadcast default (resolve at implement).

## Acceptance
- [ ] Form submits → OTP step shown; success confirmation rendered.
- [ ] Logged-in one-click subscribe works (no email entry).
- [ ] Existing calendar link preserved.
- [ ] Web component test (submit, OTP step, logged-in path).
- [ ] web unit suite green at baseline; tsc clean.
- [ ] Live-stack: subscribe via the form, OTP lands in Mailpit, go-live email lands in Mailpit
      after driving a channel live.

## Review (2026-06-15)

**Verdict**: Approve — verified by implement (tsc clean, tests green, live-stack confirmed where applicable); fast-lane advance.
