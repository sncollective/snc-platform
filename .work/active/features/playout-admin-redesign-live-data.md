---
id: playout-admin-redesign-live-data
kind: feature
stage: drafting
tags: [playout, admin-console]
release_binding: null
depends_on: [bold-event-spine-sse-endpoint, bold-event-spine-publishers]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: playout-admin-redesign
---

# Live data — the screen tells the truth

## Brief
The playout admin's data layer converts from the 3s poll to spine subscriptions
(`playout.queue-changed`, `playout.now-playing-changed`, `playout.engine-restarted`)
— born subscribed; this feature absorbs the admin half of the retired
`bold-event-spine-client-subscriptions`. Data freshness becomes visible per the epic
design decision: a persistent, subtle connection-state indicator (live / reconnecting)
plus a prominent stale banner with last-updated time when the event stream drops —
killing today's silent-stale failure mode where a dead poll is indistinguishable from
a healthy screen. Actions stop lying by omission: optimistic queue updates (remove/add
reflect immediately instead of surviving up to 3s), the "nothing playing" state
distinguishes "Liquidsoap reports nothing" from "Liquidsoap is not responding" (today
identical), and engine-restart progress renders honestly (the pulsing channel-tab dot
currently never appears because a fixed 500ms reload races the restart — tie the
reload to `engineStatus === "ready"` instead).

Coordination: the drift/restart banner from `bold-channel-topology-drift-detection`
lands on this screen — whichever feature designs second reads the other's design
section so the status real estate is shared, not duplicated. Does NOT cover layout
(sibling `responsive-structure`) or consequence dialogs (sibling `honest-actions`).

Audit grounding: admin A1 (stale-window sev-2s), A3 (restart indicator sev-2), and
the state-inspection verdicts (queue-poll failure handled-poorly, concurrent-admin
staleness unhandled, nothing-playing handled-poorly) in
`streaming-playout-ux-review-admin-audit` (archived; body at git 85151fd).

## Epic context
- Parent epic: `playout-admin-redesign`
- Position in epic: the spine-consumer arc — blocked on the two `bold-event-spine`
  features (cross-epic edges).

## Foundation references
- `docs/streaming.md` — playout architecture, Liquidsoap/SRS roles
- `docs/job-queues.md` — engine restart flow
