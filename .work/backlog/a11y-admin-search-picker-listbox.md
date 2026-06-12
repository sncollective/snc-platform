---
id: a11y-admin-search-picker-listbox
kind: backlog
tags: [playout, admin-console, accessibility]
created: 2026-06-12
---

# Search picker results not using listbox/option ARIA pattern

**Violation:** WCAG 2.2 SC 4.1.2 Name, Role, Value (AA) — interactive elements must have an accessible role that correctly describes their purpose.

**Observed:** Both `ContentSearchPicker` and `PoolItemPicker` render result items as `<div role="button" tabIndex={0}>` elements, not as a listbox/option pattern. This means:
- Screen readers announce each result as a "button" rather than an item in a list
- Arrow key navigation is not implemented (users must Tab through each result)
- No `aria-selected` or `aria-activedescendant` support
- The picker container has no `role="listbox"` or `role="combobox"` association

**File:line:**
- `apps/web/src/components/admin/content-search-picker.tsx:99` — `<div role="button" tabIndex={0}>`
- `apps/web/src/components/admin/pool-item-picker.tsx:99` — `<div role="button" tabIndex={0}>`

**Severity:** 2 (minor for sighted keyboard users; potentially major for screen reader users).

**Fix direction:** Wrap results in `<ul role="listbox">` and render each result as `<li role="option">`. Implement arrow key navigation with `aria-activedescendant` on the input, or use a `combobox` pattern (the input already provides text filtering). The `onKeyDown` Enter/Space handlers on each div should be moved to the listbox keyboard management.
