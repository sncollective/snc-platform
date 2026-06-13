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
