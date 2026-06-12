---
id: playout-admin-redesign
kind: epic
stage: implementing
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

## Design decisions (user, 2026-06-12 epic design)
- **Design-system primitives are standalone features**: `responsive-table-card-pattern`
  and `shared-confirm-dialog-component` were promoted from backlog to parentless
  features; this epic's children depend on them rather than building them inline.
  (Rejected: build-inside-first-consumer — leaner, but the user chose clean
  design-system ownership.)
- **Channel deletion is in scope**: the missing delete affordance (sev-3,
  `bug-admin-no-channel-delete`) joins channel creation in the `honest-actions`
  feature as one coherent lifecycle piece, API work included.
- **Data freshness model**: persistent subtle connection-state indicator (live /
  reconnecting) PLUS a prominent stale banner with last-updated time on stream drop.
  (Rejected: failure-banner-only — "no news is good news" is the silent-failure
  pattern the audit flagged.)
- **Mobile information architecture: deferred to the design pass** of
  `responsive-structure` — prototype single-page-stacked vs sub-tabs-at-mobile
  against real layouts and decide with evidence there.

## Decomposition

Split by the epic's two mandates plus the action-honesty family the audit surfaced:
layout (`responsive-structure`), data truth (`live-data`), and consequence
communication (`honest-actions`). The two design-system primitives the children
depend on are standalone parentless features (user decision above), so this epic's
critical path runs through them and the spine features — but all three children are
independently designable now.

### Child features

- `playout-admin-redesign-responsive-structure` — table→card adoption, sev-4 form
  fix, picker/tab scaling; mobile IA decided at design — depends on:
  `[responsive-table-card-pattern]`
- `playout-admin-redesign-live-data` — spine subscriptions, freshness
  indicator+banner, optimistic updates, honest engine-restart state — depends on:
  `[bold-event-spine-sse-endpoint, bold-event-spine-publishers]` (cross-epic)
- `playout-admin-redesign-honest-actions` — channel create-warning + delete
  (end-to-end), shared confirm dialog adoption, semantics note, queue copy fixes —
  depends on: `[shared-confirm-dialog-component]`

### Decomposition risks

- **Every child is blocked on something external** — unlike the live-experience
  epic, there is no zero-dependency child. The two design-system primitives are
  small, so the practical critical path is short, but nothing here is ready until
  they (or the spine features) design+land. If queue pressure demands, the
  primitives are the items to pull first.
- **Three siblings converge on the queue UI**: `live-data` (optimistic updates,
  disabled-skip truth), `honest-actions` (skip affordance copy, "Up next"), and
  `responsive-structure` (queue layout). Designs must cross-read; implementation
  should bundle or serialize the playout.tsx writers.
- **Drift-banner coordination**: `bold-channel-topology-drift-detection` lands a
  banner on this screen; `live-data` owns the screen's status real estate.
  Whichever designs second reads the other.
