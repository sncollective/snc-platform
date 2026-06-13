---
id: playout-admin-redesign-honest-actions-toggle-feedback
kind: story
stage: review
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

## Implementation notes (2026-06-13)
Added `toaster` import from `../ui/toast.js` to
`apps/web/src/components/simulcast/simulcast-destination-manager.tsx`. In
`handleToggleActive`'s success path, after `loadDestinations()` resolves, calls
`toaster.success({ title: dest.isActive ? "Destination deactivated" : "Destination
activated" })` — pre-toggle value inverts as designed. Failure path unchanged (sets
`error` state, which renders the error banner via `role="alert"`).

Test file updated: `apps/web/tests/unit/components/simulcast-destination-manager.test.tsx`
— added `vi.hoisted` + `vi.mock` for the toast module (matching the chat-context test
convention), and a new describe block "SimulcastDestinationManager – toggle active
feedback" with three tests: deactivate direction, activate direction, and failure path
(no toast on error). All 1737 web tests pass; typecheck clean.

**Fix-verify loopback:** UI change — user should confirm the "Destination activated" and
"Destination deactivated" toasts fire correctly in the running app at review. Not blocking.
