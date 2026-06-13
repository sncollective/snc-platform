---
id: playout-admin-redesign-responsive-structure-simulcast-table
kind: story
stage: implementing
tags: [playout, admin-console, streaming]
release_binding: null
depends_on: [shared-confirm-dialog-component-simulcast-adoption]
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: playout-admin-redesign-responsive-structure
---

# Simulcast manager collapses variant branches onto ResponsiveTable

## Scope
Unit 2 of the parent feature: both render branches of
`apps/web/src/components/simulcast/simulcast-destination-manager.tsx` (table + list)
become one `ResponsiveTable<SimulcastDestination>` with
`mode={variant === "list" ? "cards" : "auto"}`, `tableAt="md"`, RTMP URL column
`cardRole: "hidden"`. The ConfirmDialog delete flow (landed by the depends_on story)
must keep working in both views. Adds the one-line live-reload semantics note. Dead
list/table CSS removed. Delete `.work/backlog/a11y-admin-simulcast-table-mobile.md`
in this story's commit. Exact column spec + acceptance criteria in the parent feature
body.
