---
id: live-experience-redesign-notify-me-subscribe-api
kind: story
stage: review
tags: [streaming, community]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-15
updated: 2026-06-15
parent: live-experience-redesign-notify-me
---

# Per-channel notify-me subscription: schema + OTP-signup subscribe API

Units 1 + 2 of the parent design — the per-channel subscription model and the public
OTP-signup capture route. Reuses the `email-capture-at-shows` OTP path + `consentLog`.

## Units

- **Schema** (`notification.schema.ts` + `packages/shared/src/notification.ts`):
  `channelNotifySubscriptions` (userId + channelId PK, channel-indexed); add
  `"channel_go_live"` to `NOTIFICATION_EVENT_TYPES`. Reuse/land the `consentLog` per the
  email-capture design. Migration via `drizzle-kit generate` ONLY.
- **Service** (`services/notify-when-live.ts`): `subscribeToChannel(userId, channelId,
  policyVersion)` (PK-upsert + consent insert, idempotent); `unsubscribeFromChannel`.
- **Routes** (`routes/notify.routes.ts`, mounted in app.ts):
  - `POST /api/notify-when-live` — public, `rateLimiter`. `{channelId, email, consent: true,
    policyVersion}`. Send OTP → on verify, the authed user is subscribed + consent logged.
    Share the email-capture OTP extension, don't duplicate it.
  - `DELETE /api/notify-when-live/:channelId` — `requireAuth`, unsubscribe.

## Acceptance
- [ ] Migration applies; `channel_notify_subscriptions` + `channel_go_live` event type present.
- [ ] Subscribe is idempotent (re-subscribe = no-op).
- [ ] `consent` not literal `true` → 422, no write.
- [ ] Happy-path + auth-failure tests per route (project convention).
- [ ] api unit suite green at baseline; tsc clean.
