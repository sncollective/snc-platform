---
id: shared-confirm-dialog-component-simulcast-adoption
kind: story
stage: implementing
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
