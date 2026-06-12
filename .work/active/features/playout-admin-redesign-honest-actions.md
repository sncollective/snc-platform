---
id: playout-admin-redesign-honest-actions
kind: feature
stage: drafting
tags: [playout, admin-console]
release_binding: null
depends_on: [shared-confirm-dialog-component]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: playout-admin-redesign
---

# Honest actions — consequences stated before, feedback after

## Brief
Destructive and disruptive admin actions communicate consequence before firing and
confirm outcome after. Channel lifecycle becomes coherent and complete: channel
creation warns pre-create that it briefly restarts the playout engine (today the
warning arrives as a retroactive toast), and channel **deletion** is added end-to-end
— API + UI with confirmation carrying the same restart warning (in scope by user
decision, 2026-06-12 epic design; absorbs `bug-admin-no-channel-delete` — close it
when this lands). The simulcast destination delete swaps its bare `window.confirm`
for the shared confirm dialog (dependency: `shared-confirm-dialog-component`; closes
`bug-admin-simulcast-window-confirm` when adopted). Smaller honesty fixes ride along:
the admin simulcast page states its immediate-effect semantics ("changes to active
destinations take effect immediately on the live stream" — the admin/creator
semantics split is code-confirmed at `apps/api/src/services/simulcast.ts`), the
activate/deactivate toggle gets success feedback, the queue's misleading "est. 00:00"
on position 1 becomes "Up next", the queue picker's silent playout-only filter gets
an explanatory empty state, and the skip button renders disabled-with-reason instead
of vanishing when nothing is playing.

Does NOT cover layout (sibling `responsive-structure`) or the data layer (sibling
`live-data`) — but the disabled-skip and optimistic-update behaviors meet at the
queue UI; coordinate with `live-data` at design time.

Audit grounding: admin A1 (est sev-2, picker sev-2, skip sev-2), A3 (create warning
sev-2, no delete sev-3), A5 (semantics sev-2, window.confirm sev-2, toggle sev-1) in
`streaming-playout-ux-review-admin-audit` (archived; body at git 85151fd).

## Epic context
- Parent epic: `playout-admin-redesign`
- Position in epic: consumer of the shared confirm-dialog primitive; otherwise
  spine-independent.

## Foundation references
- `docs/streaming.md` — simulcast semantics, channel model
- `docs/admin.md` — admin surface conventions
