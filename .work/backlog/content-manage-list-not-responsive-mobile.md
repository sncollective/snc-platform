---
id: content-manage-list-not-responsive-mobile
created: 2026-06-15
tags: [bug, a11y]
---

# Creator content-management list is not responsive at mobile — title link collapses to width:0

Found during `e2e-suite-drift-triage` (2026-06-15) running the suite against the live
stack. On `/creators/<handle>/manage/content` at mobile viewport (412px / Pixel 7),
the content-item title link renders at **width:0** — present in the DOM but invisible
and unclickable. Confirmed via Playwright `boundingBox`: `width=0, height≈25px,
visible=false` for the single "Midnight Frequencies" match.

## Root cause

The content list is a desktop table-grid with **no mobile treatment at all**:

- `apps/web/src/components/content/content-row.tsx:134` sets
  `style={{ gridTemplateColumns: fullTemplate }}` inline — a 9-column template
  (`1fr` title + 8 fixed columns, ~48rem of fixed track) applied at **every**
  viewport. The header row does the same at `content-section.tsx:68`.
- `apps/web/src/components/content/content-management-list.module.css` contains
  **zero `@media` queries**. `.gridRow` (`display: grid`) and `.gridCell`
  (`overflow: hidden`) both lack `min-width: 0`.

At 412px the ~48rem of fixed columns exceed the viewport, and because the `1fr`
title cell has no `min-width: 0` to let it shrink-with-content under an
`overflow: hidden` grid child, the grid collapses that column to width:0 to avoid
overflow.

## Fix direction (not yet designed)

Two layers, both needed:

1. **Min-width guard** — add `min-width: 0` to `.gridRow` and `.gridCell` so the
   `1fr` column can shrink and ellipsis-truncate instead of collapsing.
2. **Mobile layout** — the desktop 9-column table doesn't fit a phone regardless;
   add a `@media (max-width: 767px)` branch that collapses the row to a stacked /
   card layout (title + key metadata, drop the fixed columns). The inline
   `gridTemplateColumns` needs a mobile override or a CSS-var hand-off so the media
   query can win. Mirror the calendar-mobile and bookings-desktop-mobile patterns
   already parked.

## e2e linkage

Breaks two mobile assertions, both skip-linked to this item until fixed:
`content-manage.spec.ts` "content list shows published and draft sections" (:14) and
"content title links to edit page" (:39). Both pass at desktop. The chipBar mobile
nav itself is fine — this is purely the content-row layout.
