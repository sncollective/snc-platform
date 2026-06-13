---
id: playout-admin-redesign-honest-actions-toggle-feedback
kind: story
stage: implementing
tags: [playout, admin-console, streaming]
release_binding: null
depends_on: [playout-admin-redesign-responsive-structure-simulcast-table]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: playout-admin-redesign-honest-actions
---

# Simulcast toggle success feedback

## Scope
Unit 3 of the parent feature: `handleToggleActive` in
`apps/web/src/components/simulcast/simulcast-destination-manager.tsx` gains a success
toast ("Destination activated" / "Destination deactivated" — pre-toggle value
inverts). Tiny story, kept separate to serialize behind responsive-structure's
simulcast-table rewrite of the same file (declared dep). Acceptance criteria in the
parent feature body.

## Resume note (2026-06-13)
Designed, not implemented; dep satisfied (simulcast-table archived). Disjoint from the
`playout.tsx` siblings — can run in parallel. Re-read the current
`simulcast-destination-manager.tsx` `handleToggleActive` before implementing (it was
last rewritten by the simulcast-table ResponsiveTable adoption). See the parent
feature's `## Resume note`.
