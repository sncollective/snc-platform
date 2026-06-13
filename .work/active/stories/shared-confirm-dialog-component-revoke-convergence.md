---
id: shared-confirm-dialog-component-revoke-convergence
kind: story
stage: review
tags: [design-system, streaming]
release_binding: null
depends_on: [shared-confirm-dialog-component-component]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: shared-confirm-dialog-component
---

# Creator key-revoke confirm converges onto ConfirmDialog

## Scope
Unit 3 of the parent feature: replace the local DialogRoot-based revoke confirm in
`apps/web/src/routes/creators/$creatorId/manage/streaming.tsx` (~lines 357–388) with
`<ConfirmDialog>` keeping the existing `keyPendingRevoke` state shape and consequence
sentence. Remove the now-unused dialog imports and the bespoke
`.revokeDialogActions` / `.revokeConfirmButton` / `.revokeCancelButton` rules from
`streaming.module.css`. Update route tests if they assert on the old structure.

## Acceptance criteria
- All Unit 3 acceptance criteria in the parent feature body (behavior unchanged;
  bespoke markup/CSS gone).
- `bun run --filter @snc/web test` and `build` green.

## Implementation notes

**Files changed:**
- `apps/web/src/routes/creators/$creatorId/manage/streaming.tsx` — replaced the
  local `DialogRoot`-based revoke confirm (lines 357–388) with `<ConfirmDialog>`.
  Removed all five dialog imports (`DialogRoot`, `DialogBackdrop`, `DialogContent`,
  `DialogTitle`, `DialogDescription`) — none were used elsewhere in the file.
  Added `ConfirmDialog` import from `../../../../components/ui/confirm-dialog.js`.
  `keyPendingRevoke` state shape and `handleConfirmRevoke` handler unchanged.
- `apps/web/src/routes/creators/$creatorId/manage/streaming.module.css` — removed
  the `.revokeDialogActions`, `.revokeConfirmButton` (+ `:hover`, `:focus-visible`),
  and `.revokeCancelButton` (+ `:hover`, `:focus-visible`) rule blocks; nothing else
  in the file referenced them.

**Tests:** No test changes required — the existing tests already queried by ARIA
role and text ("Revoke key", "Cancel"), not by CSS class names. All 1660 web tests
pass; build clean (`✓ built in 5.58s`).

**`onCancel` idempotency:** The `ConfirmDialog` contract documents that `onCancel`
may fire after `onConfirm` when the consumer's state clear triggers
`onOpenChange(false)`. The existing `setKeyPendingRevoke(null)` in `onCancel` is
already idempotent (called when already null is a no-op), so no handler changes
were needed.
