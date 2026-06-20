---
id: a11y-listbox-picker-focus-return
tags: [admin-console, accessibility]
release_binding: null
created: 2026-06-20
---

# A11y: return focus to trigger when a search/pool picker closes (WCAG 2.4.3)

Surfaced during the review pass on the `a11y-admin-playout-console` feature (2026-06-20). Not a
4.1.2 finding (that sweep covered the listbox/combobox ARIA), so it was deferred to its own item
rather than expanding that feature's scope.

## What's wrong

The admin playout pickers (`ContentSearchPicker`, `PoolItemPicker`) `autoFocus` their input when
opened, but on close — via Escape, click-outside, or selecting an item — DOM focus is dropped to
`<body>` instead of being returned to the trigger button ("+ Add to Queue" / "+ Add Content")
that opened the picker. A keyboard user is left with no focus context and must Tab from the top of
the document to get back.

This is a **WCAG 2.4.3 Focus Order** concern (and adjacent to 2.4.7 — there's no visible focus
target after close), distinct from the 2.4.11 / 4.1.2 work already done on these components.

## Fix direction

- Capture the trigger element (or use a ref to it) when the picker opens; on any close path,
  restore focus to it.
- The close paths live in `admin/playout.tsx` (where `showSearchPicker` is toggled) and in the
  pickers' own Escape / click-outside handlers. Centralize the focus-restore so all three paths
  share it.
- Consider whether `useListboxNavigation` should own an `onClose` focus-restore contract, or
  whether it stays in the picker components (the hook is currently focus-agnostic — it manages a
  *virtual* active descendant, not DOM focus).

## Verification when picked up

- [ ] Open a picker via keyboard, close it via Escape — focus returns to the trigger button.
- [ ] Same for click-outside close and select-an-item close.
- [ ] Visible focus ring on the trigger after restore.
- [ ] No regression to the existing combobox/listbox keyboard nav.
