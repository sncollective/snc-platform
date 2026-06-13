---
id: shared-confirm-dialog-component-revoke-convergence
kind: story
stage: implementing
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
