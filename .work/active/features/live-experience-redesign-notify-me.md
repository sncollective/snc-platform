---
id: live-experience-redesign-notify-me
kind: feature
stage: drafting
tags: [streaming, community]
release_binding: null
depends_on: [live-experience-redesign-live-state]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: live-experience-redesign
---

# Notify me when live

## Brief
The conversion loop for the offline state: a viewer who lands on `/live` while nothing
is airing can leave an email (or, when logged in, one-click subscribe) and get notified
when a channel goes live. Server-side this triggers from the live-state transition the
`live-state` sibling establishes (the same internal event the spine publishers emit) —
a pg-boss job sends the notification email via the existing SMTP path. Includes the
capture affordance on the offline surface (joining the calendar link that `page-states`
ships), the subscription storage, the send-on-live-transition job with basic
debouncing (a channel flapping live/offline must not spam), and unsubscribe.

Scoped into this epic by explicit user decision (2026-06-12 epic design: offline-state
affordance = calendar link AND notify-me), accepting that it pulls notification
plumbing into the redesign's blast radius. Does NOT cover general notification
preferences/infrastructure beyond this single notify-me loop — if a broader
notification system emerges later, this migrates into it.

## Epic context
- Parent epic: `live-experience-redesign`
- Position in epic: consumer of `live-state` — needs the server-side live-state
  representation as its trigger. Last in the dependency chain; transitively behind the
  spine features.

## Foundation references
- `docs/streaming.md` — channel/live model
- Email in dev: Mailpit (SMTP capture) — see AGENTS.md §Email in dev
