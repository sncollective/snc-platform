---
id: playout-admin-redesign-responsive-structure-form-and-chrome
kind: story
stage: implementing
tags: [playout, admin-console]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: playout-admin-redesign-responsive-structure
---

# Create-form wrap, picker width, channel-tab scroll

## Scope
Unit 3 of the parent feature, all in `apps/web/src/routes/admin/playout.tsx` +
`playout.module.css`: (1) sev-4 fix — create-channel inline-style flex rows become
module classes with `flex-wrap: wrap` + input `flex: 1 1 200px; min-width: 0`;
(2) `.channelTabs` gets `overflow-x: auto` / `flex-wrap: nowrap` / `flex-shrink: 0`
tabs (mirror the ContextShell chip bar); (3) picker dropdown `min-width: 260px`,
right-anchored in-viewport. Delete
`.work/backlog/a11y-admin-new-channel-form-mobile.md` in this story's commit. Exact
spec + acceptance criteria in the parent feature body.

## Coordination
Writes `playout.module.css` and `playout.tsx` — bundle or serialize with sibling
`…-pool-table` (same file).
