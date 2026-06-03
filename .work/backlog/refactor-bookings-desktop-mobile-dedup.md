---
tags: [refactor, quality, studio]
created: 2026-04-20
---

Eliminate the near-identical desktop and mobile renderers in the dashboard bookings table by extracting shared cell components and collapsing to a single responsive tree.

## Scope

- Dashboard bookings table component(s) — locate the two parallel renderers (desktop table and mobile card/list variant). The exact file(s) are likely under `apps/web/src/routes/` or `apps/web/src/components/` in the dashboard or bookings area; identify them during implementation.
- Extract cell components (status badge, date display, action buttons, etc.) shared between the two renderers into reusable pieces.
- Replace the two parallel trees with either: (a) a single component using responsive CSS classes/breakpoint variants, or (b) a single component with a `variant` prop for mobile/desktop — whichever fits the existing CSS module pattern better.

## Tasks

- [ ] Locate the desktop and mobile booking table renderers; measure actual duplication.
- [ ] Extract shared cell components (status, date, actions) to `components/bookings/` or equivalent.
- [ ] Replace parallel trees with a single responsive component or a component with a `variant` prop.
- [ ] Visually verify both breakpoints render correctly after the change.

## Notes

If on inspection the two variants diverge significantly (different data displayed, different interaction model), prefer shared cell components without collapsing the top-level trees — partial dedup is still a win. Only collapse to a single tree if the structural divergence is purely cosmetic (layout, spacing). Do not introduce a new CSS framework or utility library to accomplish this; use the existing CSS module pattern.
