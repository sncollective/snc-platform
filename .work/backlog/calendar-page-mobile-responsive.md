---
id: calendar-page-mobile-responsive
tags: [ux-polish, design-system]
release_binding: null
created: 2026-04-20
updated: 2026-06-18
---

# Calendar page mobile responsive pass

The `/calendar` + `/governance/calendar` page (shared `routes/calendar.module.css`) isn't mobile-responsive. At 320-420px viewport:

- `.navRow` (Previous / Month label / Next) has no wrap; `.monthLabel` carries `min-width: 200px`; the Previous/Next buttons fall off the screen.
- `.filterRow` (event type / creator / audience selects) has no wrap; forces horizontal page scroll at narrow widths.
- Observed 2026-04-20 during `context-shell-mobile-sub-nav` review: horizontal page scroll on `/governance/calendar` also made the new sticky chip bar appear to "fall off horizontally" — a direct side-effect of the page forcing a wider-than-viewport layout.

Not caught by `responsive-overhaul`'s Unit 7 sweep — `calendar.module.css` wasn't in the 18-file audit of files with `max-width` media queries (the sweep was bounded to files that already had responsive styling to invert). The calendar page just had no responsive styling at all.

## Likely shape

- `.navRow`: stack Previous / Label / Next into column on mobile, OR wrap + drop the 200px min-width on the label.
- `.filterRow`: `flex-wrap: wrap` with sensible gap + stretch selects to fill rows.
- `.headerRow`: check the New Event button doesn't push the "Calendar" heading off-screen.

## Month-grid cramping (absorbed from calendar-month-view-vertical-mobile-polish, 2026-06-18)

The other half of the same mobile pass: at 320–420px the month view fits all 7 weekday columns but
cells become cramped and event labels truncate aggressively (observed "M..." for a day-long event) —
the `calendar-grid.module.css` `repeat(7, 1fr)` is structurally right; the issue is event chips have
nowhere to grow. `responsive-overhaul` explicitly parked calendar-grid as "None (appropriate — week
grid)", so this is net-new mobile treatment, not a re-do. Likely shape (one of):
- mobile-default `/calendar` to the existing Timeline toggle instead of Month;
- keep month but render event chips dots-only on narrow widths, tap-to-see-list;
- 3-day focus mode on mobile (narrower grid, wider cells).

## Verification when picked up

- [ ] `/calendar` at 320×568 shows Previous/Label/Next all in-bounds
- [ ] Filter selects wrap or stack cleanly, no horizontal page scroll
- [ ] `/governance/calendar` renders the ContextShell chip bar at correct position (not "off-screen horizontally" — should resolve as a side-effect of fixing the page's own overflow)
- [ ] Month grid usable for browsing + tapping events at 320×568; day-long event titles legible (not truncated to a single character); view toggle still works after whatever mobile default is chosen
- [ ] No regression at ≥768px
