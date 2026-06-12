---
id: playout-admin-redesign-responsive-structure
kind: feature
stage: drafting
tags: [playout, admin-console]
release_binding: null
depends_on: [responsive-table-card-pattern]
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: playout-admin-redesign
---

# Responsive structure — the admin screens fit a pocket

## Brief
The playout admin (`apps/web/src/routes/admin/playout.tsx`) and simulcast admin
(`admin/simulcast.tsx`) screens become structurally usable at 375px. Adopts the shared
table→card primitive (dependency: `responsive-table-card-pattern`) for the content-pool
table (today 525px wide at a 375px viewport) and the simulcast table (696px); fixes the
severity-4 create-channel form (input + Create + Cancel in a no-wrap flex row measuring
453px — submit entirely off-screen); widens the cramped ContentSearchPicker dropdown
(131px, clips titles); and handles channel-tab scaling beyond 2 tabs (audit: functional
at 2, likely overflows at 3+).

**Mobile information architecture is deferred to this feature's design pass** (user
decision, 2026-06-12 epic design): prototype single-page-stacked-with-cards vs
sub-tabs-at-mobile against real layouts and decide with evidence there.

Absorbs the a11y backlog items whose root cause this removes — close
`a11y-admin-new-channel-form-mobile`, `a11y-admin-pool-table-mobile-overflow`, and
`a11y-admin-simulcast-table-mobile` when this lands. Does NOT cover what the data says
(sibling `live-data`) or action consequences (sibling `honest-actions`).

Audit grounding: admin findings A2 (pool overflow sev-3), A3 (form sev-4, tabs sev-1),
A5 (simulcast table sev-3) in `streaming-playout-ux-review-admin-audit` (archived;
body at git 85151fd).

## Epic context
- Parent epic: `playout-admin-redesign`
- Position in epic: first adopter of the design-system table→card primitive; layout
  arc, spine-independent.

## Foundation references
- `docs/admin.md` — admin surface conventions
- `docs/ux-decisions.md` — mobile-ergonomics evidence
