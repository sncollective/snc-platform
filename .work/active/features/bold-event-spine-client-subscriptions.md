---
id: bold-event-spine-client-subscriptions
kind: feature
stage: drafting
tags: [streaming]
release_binding: null
depends_on: [bold-event-spine-publishers, refactor-use-polling-hook-extraction]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: bold-event-spine
---

# Convert polling consumers to subscriptions

## Brief
Convert the two polling consumers to spine subscriptions: the admin playout queue view
(`apps/web/src/routes/admin/playout.tsx`, 3s interval) and the global player live-status
check (`apps/web/src/components/media/global-player.tsx`, 10s interval, every user).
Subscription hook with automatic fallback to polling when the EventSource fails — which
is why this depends on `refactor-use-polling-hook-extraction` (in-flight): the extracted
`usePolling` hook becomes the fallback layer, and both features touch the same call
sites, so let it land first.

Coordination note (2026-06-12): `streaming-playout-ux-review` may trigger redesigns of
exactly these screens. If a redesign proceeds for a surface, that surface's conversion
moves into the redesign work (screens born subscribed) and this feature shrinks to the
surfaces the redesign doesn't touch. Check the review's outcome before designing this.
