---
tags: [ux-polish, design-system]
release_binding: null
created: 2026-04-20
---

# Calendar month-view vertical mobile polish

At narrow mobile viewports (320–420px), the `/calendar` month view fits all 7 weekday columns but cells become cramped and event labels truncate aggressively (observed: "M..." for a day-long event). Not unusable — dates, navigation, and event presence are all readable — but the information density is tight enough that a dedicated mobile treatment would help.

Observed 2026-04-20 during responsive-overhaul review at 320×568 viewport (Pixel/iPhone SE-class width). The `calendar-grid.module.css` `repeat(7, 1fr)` is the right structure for a week view; the issue is that event chips inside cells have nowhere to grow.

The responsive-overhaul epic brief explicitly parked calendar-grid as "None (appropriate — week grid)" — no mobile collapse was planned. This item is the follow-up for mobile-specific polish.

## Likely shape

- Default `/calendar` on mobile to timeline view instead of month (the existing Timeline toggle already exists)
- Or: keep month but render event chips as dots-only on narrow widths, with tap-to-see-list
- Or: 3-day focus mode on mobile (narrower grid, wider cells)

## Verification when picked up

- [ ] Calendar usable for browsing + tapping events at 320×568
- [ ] Day-long event titles legible (not truncated to single character)
- [ ] Whatever default view renders on mobile, the toggle between views still works
