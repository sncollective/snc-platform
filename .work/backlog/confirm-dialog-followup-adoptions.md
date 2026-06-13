---
id: confirm-dialog-followup-adoptions
kind: backlog
tags: [design-system, cleanup]
created: 2026-06-13
---

# Adopt ConfirmDialog at the 6 remaining window.confirm sites

Deep review of `shared-confirm-dialog-component` (2026-06-13) found 6 pre-existing
`window.confirm` sites outside that feature's scope: `kebab-menu.tsx:37`,
`settings/subscriptions.tsx:61`, `admin/creators.tsx:70`, `use-content-delete.ts:22`,
`use-content-management.ts:100,170`. With 8 total confirm sites the component's own
revisit condition for the rejected `useConfirm()` promise API ("revisit if confirm
sites proliferate past ~5 and the pending-state boilerplate starts hurting") is
arguably tripped — when adopting, evaluate whether to add the promise-hook ergonomic
layer rather than threading pending-state through all six (the two hook sites
especially can't render a dialog themselves).
