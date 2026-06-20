---
id: a11y-admin-playout-console
kind: feature
stage: review
tags: [playout, admin-console, accessibility]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-20
updated: 2026-06-20
---

# A11y sweep: admin playout console (tabs + search pickers)

Consolidates two WCAG 4.1.2 findings from the 2026-06-12 streaming/playout UX review, both on
the admin playout console. Batch shape (A): one feature, one task per finding.

Folds in (and replaces) the backlog items: `a11y-admin-tabs-no-tabpanel`,
`a11y-admin-search-picker-listbox`.

## Tasks

- [x] **Channel tabs missing tabpanel (WCAG 4.1.2)** — `admin/playout.tsx` had `role="tablist"`
  + `role="tab"` + `aria-selected` but no `role="tabpanel"` on the content region and no
  id/`aria-controls`/`aria-labelledby` wiring. Added `id` + `aria-controls` to each tab button
  (`playout-tab-<id>` ↔ `playout-panel-<id>`) and wrapped the channel content region
  (Now Playing / Queue / Content Pool) in a `<div role="tabpanel" tabindex={0}>` labelled by the
  active tab. Added a `.tabPanel` class carrying the page's column-flex + `--space-xl` gap so the
  inter-section spacing survives the new wrapper (the sections were previously direct flex
  children of `.page`). `playout.tsx` + `playout.module.css`.
- [x] **Search pickers not using listbox/option (WCAG 4.1.2)** — `ContentSearchPicker` and
  `PoolItemPicker` rendered results as `<div role="button" tabIndex={0}>` with no arrow-key nav,
  no `aria-selected`, no listbox association. Both converted to the WAI-ARIA
  combobox-with-listbox pattern: input is `role="combobox"` with `aria-activedescendant`, results
  are `<ul role="listbox">`, items are `<li role="option">`, empty-states are
  `role="presentation"`. Arrow Up/Down/Home/End move a virtual focus; Enter selects; hover and
  keyboard share the `aria-selected` highlight.

## Shared hook

The keyboard + ARIA logic is extracted to `apps/web/src/hooks/use-listbox-navigation.ts`
(`useListboxNavigation`) rather than duplicated across the two near-identical pickers. It exposes
prop-getters (`getInputProps` / `getListboxProps` / `getOptionProps`) and manages the active
index.

**Bug caught by test (kept as a regression guard):** the first cut reset the active index on every
`items` *reference* change. Both pickers recompute their `filtered` array each render, so this
reset fired on every keystroke and `aria-activedescendant` never stuck. Fixed to key the
clamp effect on `items.length` (clamp-in-bounds, not reset-to-none). The `pool-item-picker`
test exercises ArrowDown→Enter, ArrowUp-wrap, and click-select to lock this in.

## Verification

- Web unit suite green: 1764/1764 (added 4 keyboard-nav tests to `pool-item-picker.test.tsx`).
- `tsc --noEmit` clean on `@snc/web`.
- Existing picker tests (text/empty-state assertions) unaffected — they never queried the old
  `role="button"`.

## Fix-verify loopback (pending)

User-verifiable in the running app at `/admin/playout`:

1. **Tabs** — (screen reader) selecting a channel tab navigates to its associated content panel;
   the panel is reachable via Tab and announces as a tab panel labelled by the channel.
2. **Pickers** — open "+ Add to Queue" or "+ Add Content"; arrow keys move a visible highlight
   through results, Enter adds the highlighted item, mouse hover still works and stays in sync.

Story stays at `stage: review` until confirmed. Provenance screenshots for the original findings
are under `.memory/scratchpad/streaming-playout-ux-review/`.

## Review pass (2026-06-20)

**Verdict: PASS-WITH-NITS → nits fixed inline.** ARIA wiring verified correct on both fronts
(tab↔tabpanel association; combobox + aria-activedescendant + listbox/option, with the active
descendant id provably pointing at a real option). The reset-on-keystroke hook bug is genuinely
fixed (clamp keyed on `items.length`, not array identity) and the `pool-item-picker` keyboard
tests would catch a regression.

- **Nit fixed:** the listbox had no accessible name. Added an optional `listboxLabel` to
  `useListboxNavigation` (emitted as `aria-label` from `getListboxProps`); both pickers now pass
  one ("Content search results" / "Content pool results").
- **Deferred (out of this sweep's scope):** focus is not returned to the trigger button when a
  picker closes (a WCAG 2.4.3 Focus Order concern, pre-existing — not a 4.1.2 finding). Filed as
  a separate backlog item rather than expanding this feature.
