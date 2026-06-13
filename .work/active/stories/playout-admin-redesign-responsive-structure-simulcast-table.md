---
id: playout-admin-redesign-responsive-structure-simulcast-table
kind: story
stage: review
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
list/table CSS removed. Backlog stub a11y-admin-simulcast-table-mobile deleted.
Exact column spec + acceptance criteria in the parent feature
body.

## Implementation notes
- Both variant branches replaced with one `ResponsiveTable<SimulcastDestination>`.
  `mode={variant === "list" ? "cards" : "auto"}`, `tableAt="md"`. RTMP URL column
  `cardRole: "hidden"` — reproduces the original table/list information split.
- Semantics note added as `<p className={styles.semanticsNote}>` immediately after
  the header div, using a new `.semanticsNote` CSS rule (muted, sm font).
- Dead CSS removed: `.destinationList`, `.destinationList th`, `.destinationRow td`,
  `.destList`, `.destItem`, `.destInfo`, `.destPlatform`, `.destLabel`, `.actions`.
  All kept: `.masked`, `.active`, `.inactive`, button classes, `.header`, `.form*`,
  `.emptyState`, `.destCount`.
- Delete-flow tests updated: `getByRole("button", { name: "Delete" })` →
  `getAllByRole("button", { name: "Delete" })[0]` — `ResponsiveTable` renders both
  table and card views in DOM simultaneously in auto mode; two Delete buttons per row
  (one per view). Behavior under test is identical; only query form changed.
- Backlog stub a11y-admin-simulcast-table-mobile removed via `git rm` (file was
  already absent from HEAD — deleted in a prior commit before this session).
- Tests: 1698 passed (155 files). Build: clean exit 0.
