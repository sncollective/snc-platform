---
id: shared-confirm-dialog-component-simulcast-adoption
kind: story
stage: review
tags: [design-system, playout, admin-console]
release_binding: null
depends_on: [shared-confirm-dialog-component-component]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: shared-confirm-dialog-component
---

# Simulcast destination delete adopts ConfirmDialog

## Scope
Unit 2 of the parent feature: replace `window.confirm` in
`apps/web/src/components/simulcast/simulcast-destination-manager.tsx` `handleDelete`
with pending-state + `<ConfirmDialog>` (rendered once, outside the table/list variant
branch — fix hits both admin and creator surfaces). Add delete-flow tests (confirm
deletes + reloads; cancel doesn't) to the component's existing test file. Delete
`.work/backlog/bug-admin-simulcast-window-confirm.md` in this story's commit — the fix
it tracks lands here.

## Acceptance criteria
- All Unit 2 acceptance criteria in the parent feature body.
- `bun run --filter @snc/web test` and `build` green.

## Implementation notes

- Added `destPendingDelete: SimulcastDestination | null` state to the component. Both Delete
  buttons (table variant and list variant) now call `setDestPendingDelete(dest)` instead of
  calling `handleDelete` directly.
- Renamed `handleDelete` to `handleDeleteConfirm`; it snapshots and clears pending state first,
  then runs the existing delete + reload + error-handling logic unchanged.
- `<ConfirmDialog>` rendered once at component foot, outside the table/list variant branch.
  Consequence message names the destination label. `onCancel` clears pending state
  (idempotent — safe when `ConfirmDialog` fires it after `onConfirm` per the JSDoc contract).
- Import uses `.js` extension per conventions.
- Three delete-flow tests added to `simulcast-destination-manager.test.tsx`: open-dialog-no-call,
  confirm-calls-and-reloads, cancel-closes-no-call. Used `userEvent` from `@testing-library/user-event`
  matching the confirm-dialog test conventions.
- `window.confirm` is fully removed from the component.
- `.work/backlog/bug-admin-simulcast-window-confirm.md` removed in this commit.
- Tests: 1663 passed. Build: clean exit code 0.
