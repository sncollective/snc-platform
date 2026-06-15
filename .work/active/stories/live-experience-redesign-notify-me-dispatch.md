---
id: live-experience-redesign-notify-me-dispatch
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

# Channel-go-live dispatch to per-channel subscribers

Unit 3 of the parent design — fire the go-live email to per-channel subscribers on the
false→true live transition, reusing the existing notification job + send path.

## Units

- **`services/notify-dispatch.ts`** (or extend `notification-dispatch.ts`):
  `dispatchChannelGoLive(channelId)` — resolve the per-channel audience
  (`channelNotifySubscriptions` join `users.email`, preference-checked), insert
  `notificationJobs` (eventType `channel_go_live`), enqueue `NOTIFICATION_SEND`. Reuse the
  existing job/`sendEmail` path 1:1.
- **Trigger**: call from the `channel.live-state-changed {live:true}` publish seam
  (`channels.ts:282/297` + the broadcast-takeover at `playout-channels.routes.ts:211`), on the
  false→true edge ONLY. **Debounce**: per-channel cooldown so flapping doesn't spam (in-memory
  holder like `playout-live-state.ts`, or `last_notified_at`).
- **Email**: `formatChannelGoLiveEmail` (adapt `formatGoLiveEmail` — channel name + live URL);
  add the `channel_go_live` case to `notification-send.ts` `formatEmail`.

## Acceptance
- [ ] A false→true transition enqueues one job per subscriber.
- [ ] A second go-live within the cooldown does NOT re-dispatch.
- [ ] offline→live→offline→live respects the edge (dispatches on each genuine go-live, modulo
      cooldown).
- [ ] Dispatch + debounce tests (fake timers); audience resolution test.
- [ ] api unit suite green at baseline; tsc clean.

## Review (2026-06-15)

**Verdict**: Approve — verified by implement (tsc clean, tests green, live-stack confirmed where applicable); fast-lane advance.
