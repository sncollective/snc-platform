---
id: playout-admin-redesign-responsive-structure-pool-table
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

# Content pool table adopts ResponsiveTable

## Scope
Unit 1 of the parent feature: `apps/web/src/components/admin/content-pool-table.tsx`
keeps its public props API but renders a `ResponsiveTable<ChannelContent>` internally
(Title as card title; Duration/Source/Last Played/Plays as fields; Retry+Remove via
`actions`). Empty state gains the action prompt. Dead `.poolTable*` rules removed from
`playout.module.css`. Delete `.work/backlog/a11y-admin-pool-table-mobile-overflow.md`
in this story's commit. Exact column spec + acceptance criteria in the parent feature
body.

## Coordination
Writes `playout.module.css` — bundle or serialize with sibling
`…-form-and-chrome` (same file).
