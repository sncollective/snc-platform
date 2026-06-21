---
id: timeline-checkbox-no-live-update
tags: [calendar, ux-polish, bug]
release_binding: null
created: 2026-06-20
---

# Timeline view task checkbox doesn't update live (needs refresh)

Found 2026-06-20 during the fix-verify of `calendar-task-checkbox-bug`. Clicking a task event's
completion checkbox in a **timeline** view persists correctly (DB write succeeds; after a page
reload the checkbox shows the new state) but does **not** update live — the checkbox visibly
flips only after a manual refresh.

**Not a regression from the calendar-task-checkbox-bug fix** — that fix's
`handleToggleComplete` and client/server response shapes are all correct (verified). This is a
pre-existing state-architecture bug in the shared `TimelineView` component, independent of the
creator-vs-global path.

## Scope (verified in code)

`TimelineView` renders from its **own** `useCursorPagination` hook, not from the
`useCalendarEvents` state that the toggle updates:

- `apps/web/src/components/calendar/timeline-view.tsx:36-52` — calls `useCursorPagination`
  directly, building its own fetch URL and owning its own `items`.
- The toggle handler updates a **different** hook's state:
  `apps/web/src/hooks/use-calendar-events.ts:127-139` — `handleToggleComplete` does
  `setEvents((prev) => prev.map(...))` on `useCalendarEvents`.
- The two hooks are unconnected, so the timeline's `items` stay stale until a refetch.

Why the **month grid** works live: `CalendarGrid` receives `events={cal.events}` from
`useCalendarEvents` (`manage/calendar.tsx:113-118`), so it re-renders on toggle. The timeline
does not consume `cal.events`.

**Affects all timeline surfaces, not just creator manage** — the same `TimelineView` +
`cal.handleToggleComplete` pattern is used by the governance calendar
(`governance/calendar.tsx:159-165`) and the project-detail timelines
(`manage/projects/$projectSlug.tsx`, `governance/projects_.$projectSlug.tsx`). The original
checkbox-bug story's "works in the governance/project timeline" note was about the month grid,
not the timeline checkbox.

## Fix direction

Two options (decide at design):

- **A (local merge):** after a successful toggle, merge the returned event into `TimelineView`'s
  `useCursorPagination` items. Requires `useCursorPagination` to expose a patch/setItems
  affordance, or `TimelineView` to own its toggle handler and merge there. Smallest change.
- **B (single source of truth, preferred long-term):** have `TimelineView` consume events from
  the parent's `useCalendarEvents` rather than running its own pagination, unifying the two
  state sources. Larger; aligns with the single-source-of-truth principle. Note the pagination
  responsibility would move to the parent.

## Verification

- [ ] In a timeline view, toggling a task checkbox flips it **live** (no refresh) and persists.
- [ ] Verify on creator-manage, governance, and project-detail timelines (shared component).
- [ ] Toggling off also updates live.
- [ ] Web unit/integration test that the timeline reflects a toggle without a refetch.

## Fix-verify loopback

In the running app, toggle a task checkbox in a timeline view and confirm the checkmark appears
immediately without reloading.
