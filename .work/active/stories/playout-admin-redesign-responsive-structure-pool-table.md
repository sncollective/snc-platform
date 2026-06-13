---
id: playout-admin-redesign-responsive-structure-pool-table
kind: story
stage: done
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
`playout.module.css`. Backlog stub a11y-admin-pool-table-mobile-overflow deleted in this
story's commit. Exact column spec + acceptance criteria in the parent feature body.

## Coordination
Writes `playout.module.css` — bundle or serialize with sibling
`…-form-and-chrome` (same file).

## Implementation notes

- `ContentPoolTable` now renders `ResponsiveTable<ChannelContent>` internally; public
  props API (`items`, `onRemove`, `onRetry?`) unchanged.
- Column definitions extracted to a module-level `COLUMNS` constant (static, not rebuilt on
  each render) with `cardRole: "title"` on Title and `cardRole: "field"` (default) on the
  remaining four columns.
- Empty state returns early before `ResponsiveTable` (which returns `null` for empty rows);
  empty message updated to include the action prompt per audit A2 sev-1.
- Dead CSS rules `.poolTable`, `.poolTableHeader`, `.poolTableCell` removed from
  `playout.module.css`; `.sourceBadge`, `.retryButton`, `.deleteButton`, `.emptyMessage`
  retained.
- New test `apps/web/tests/unit/components/admin/content-pool-table.test.tsx` covers: empty
  state with action prompt, column headers in table view, cell rendering (title, duration,
  source badge, last played, play count), card list presence, per-card aria-label, Remove
  button presence/callback, Retry button conditional rendering (only failed playout items
  with `onRetry` provided), Retry callback, null-title fallback (`"—"`), multiple items.
- `apps/web/tests/unit/routes/admin/playout.test.tsx` updated to use `getAllByRole` for the
  Remove button in the pool table test, since the dual render (table + card) now produces
  two buttons per item.
- Backlog stub a11y-admin-pool-table-mobile-overflow deleted (scope resolved by this
  story's implementation).

## Review (2026-06-13)
**Verdict**: Approve — held at review on fix-verify loopback (mobile layout, user confirms
at 375px in the running app). Blocker found + fixed in-review: 3 missing non-null
assertions on getAllByRole("Delete")[0] in the simulcast test (noUncheckedIndexedAccess
regression the lane's vitest+build verification couldn't catch — typecheck now exits 0,
matching the sibling pool-table story's own pattern).

**User fix-verify: confirmed 2026-06-13.** Pool renders as cards at 375px + empty-state prompt. Closed.
