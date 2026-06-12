---
id: playout-admin-redesign
kind: epic
stage: drafting
tags: [playout, admin-console]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# Playout admin redesign — fits in a pocket, tells the truth

## Brief
Redesign of the admin playout-management surfaces (`apps/web/src/routes/admin/playout.tsx`,
admin simulcast), mandated by the streaming-playout UX review go-decision (2026-06-12).
Grounded in 19 audit findings (1 catastrophic + 3 major) in the
`streaming-playout-ux-review-admin-audit` story body — read them before decomposing.

Two structural mandates:
1. **Responsive structure** (mobile is in scope by explicit decision): the content-pool
   and simulcast tables overflow severely at 375px; the create-channel form's submit
   button sits entirely off-screen (severity 4, filed:
   `a11y-admin-new-channel-form-mobile`). Use the table→card mobile pattern being
   tracked as the `responsive-table-card-pattern` design-system item rather than
   inventing per-screen layouts.
2. **Honest, live data**: replace the 3s poll / silent-stale-failure model with
   spine-fed state (`playout.queue-changed`, `playout.now-playing-changed`,
   `playout.engine-restarted`); make destructive/disruptive actions communicate
   consequence (channel creation restarts the playout engine — say so; destination
   delete uses bare `window.confirm` — use the shared confirm dialog being tracked as
   `shared-confirm-dialog-component`).

**Born subscribed**: this epic absorbs the admin half of
`bold-event-spine-client-subscriptions`. Children implementing the data layer depend
on `bold-event-spine-sse-endpoint` + `bold-event-spine-publishers`; set edges at
epic-design. Pure-layout children are spine-independent. Also coordinate with
`bold-channel-topology-drift-detection` — the drift/restart banner lands on this
screen.
