---
id: playout-admin-redesign-responsive-structure-form-and-chrome
kind: story
stage: review
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
the `a11y-admin-new-channel-form-mobile` backlog stub in this story's commit. Exact
spec + acceptance criteria in the parent feature body.

## Coordination
Writes `playout.module.css` and `playout.tsx` — bundle or serialize with sibling
`…-pool-table` (same file).

## Implementation notes

- **Create-channel form (sev-4 fix):** two inline `style={{ display: "flex", ... }}` divs
  replaced with `.newChannelRow` (outer) and `.newChannelForm` (inner). Channel name input
  gets `.newChannelInput` (`flex: 1 1 200px; min-width: 0`) via class composition with
  `formStyles.input`. Both row classes use `flex-wrap: wrap` so Create/Cancel wrap below the
  input at narrow viewports instead of overflowing off-screen.
- **Channel-tab scroll:** `.channelTabs` gains `flex-wrap: nowrap; overflow-x: auto;
  -webkit-overflow-scrolling: touch; scrollbar-width: thin` (matching ContextShell chipBar
  pattern). `.channelTab` gains `flex-shrink: 0` so tabs don't compress. A thin
  `::-webkit-scrollbar` height rule (4px) keeps the scrollbar unobtrusive.
- **Picker dropdown min-width:** `.searchPickerResults` changed from `left: 0; right: 0`
  (full-width stretch) to `left: auto; right: 0; min-width: 260px` — grows leftward from
  the right edge, stays in-viewport at narrow widths, maintains the `position: relative`
  on `.searchPicker` as its anchor.
- Test added to `playout.test.tsx`: asserts the new channel form div has no inline `style`
  attribute after clicking "+ New Channel" (class wiring confirmed).
- Backlog stub a11y-admin-new-channel-form-mobile deleted.

## Review (2026-06-13)
**Verdict**: Approve — held at review on fix-verify loopback (mobile layout, user confirms
at 375px in the running app). Blocker found + fixed in-review: 3 missing non-null
assertions on getAllByRole("Delete")[0] in the simulcast test (noUncheckedIndexedAccess
regression the lane's vitest+build verification couldn't catch — typecheck now exits 0,
matching the sibling pool-table story's own pattern).
