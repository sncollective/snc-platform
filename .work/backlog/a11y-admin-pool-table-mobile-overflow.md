---
id: a11y-admin-pool-table-mobile-overflow
kind: backlog
tags: [playout, admin-console, accessibility]
created: 2026-06-12
---

# Content pool table causes horizontal overflow at mobile (375px)

**Violation:** WCAG 2.2 SC 1.4.10 Reflow (AA) — content requiring horizontal scrolling at 320 CSS pixels.

**Observed:** At 375×812 viewport, the `ContentPoolTable` renders a 6-column table (Title, Duration, Source, Last Played, Plays, Actions) with a measured width of 525px. The body scroll width reaches 557px. The entire page becomes horizontally scrollable, placing columns beyond "Duration" off-screen.

**File:line:** `apps/web/src/components/admin/content-pool-table.tsx` (table element, all columns). CSS: `apps/web/src/routes/admin/playout.module.css` `.poolTable { width: 100% }` — this sets table to full width but does not restrict overflow.

**Severity:** 3 (major) — admin cannot view pool item status (source, last played, plays, actions including Remove) on mobile without horizontal scrolling.

**Fix direction:** Either (1) wrap the table in `overflow-x: auto` to contain the scroll within the section, or (2) render a card layout at mobile breakpoint matching how the creator simulcast list uses `variant="list"`. Option 2 is preferred for readability.
