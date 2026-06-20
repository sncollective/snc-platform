---
id: calendar-task-checkbox-bug
kind: story
stage: review
tags: [calendar, creators, bug]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-04-20
updated: 2026-06-20
---

# Calendar task checkbox non-functional in creator-manage timeline

Logged 2026-03-21 as a vague "checkbox bug"; scoped + fixed 2026-06-20. The task-completion
checkbox in the **creator-manage calendar timeline** (`/creators/$id/manage/calendar`) was dead.
It works in the governance timeline and the project-detail timeline; only this surface was broken.
(Month-grid views render event pills, not checkboxes — so this was timeline-only; the original
report's "month grid" mention was a red herring.)

## Root cause — two compounding gaps + a latent auth mismatch

1. **Handler not wired.** `manage/calendar.tsx` rendered `<TimelineView>` without an
   `onToggleComplete` prop, so clicking the checkbox did nothing (no call, no error).
2. **No creator-scoped endpoint.** The shared `handleToggleComplete` always called the **global**
   `toggleEventComplete` → `PATCH /api/calendar/events/:id/complete`. That endpoint gates on the
   org **`stakeholder`** role and looks the event up by id only — the wrong authorization model
   for creator-scoped use. A creator-team member managing their own page who isn't an org
   stakeholder would have hit a **403** even with the handler wired. (Note `handleDelete` already
   branched on `creatorId` to a creator-scoped route; the toggle didn't — that asymmetry was the
   latent bug.)

## Fix

- **API** (`creator-events.routes.ts`): added `PATCH /:creatorId/events/:eventId/complete`,
  authorized via `requireCreatorPermission(user.id, creatorId, "manageScheduling", roles)` and
  scoped via `findActiveEvent(eventId, creatorId)` — mirroring the other creator-event handlers.
  Same toggle-null↔now logic and task-type 400 guard as the global endpoint; returns the joined
  event response.
- **Web client** (`lib/calendar.ts`): added `toggleCreatorEventComplete(creatorId, eventId)`.
- **Hook** (`use-calendar-events.ts`): `handleToggleComplete` now branches on `creatorId`
  (creator-scoped vs global) exactly like `handleDelete`.
- **Wiring** (`manage/calendar.tsx`): passed `onToggleComplete={(id) => void cal.handleToggleComplete(id)}`
  to the timeline (parity with the governance call site).

## Verification

- API 1786/1786 (added 5 endpoint tests: toggle on, toggle off, non-task 400, cross-creator 404,
  manageScheduling 403). Web 1765/1765 (added a manage-calendar test asserting the timeline toggle
  reaches the creator-scoped client with the creator id). `tsc` clean both packages.

## Notes

- `UpdateCalendarEventSchema` omits `completedAt` by design (toggle-only via the dedicated
  endpoint, no arbitrary date-set) — left as-is.

## Fix-verify loopback (pending)

In the running app at `/creators/$id/manage/calendar`, timeline view: toggle a task event's
checkbox and confirm it persists across reload — including as a creator-team member who is **not**
an org stakeholder (the case the old global-endpoint path would have 403'd). Story stays at
`stage: review` until confirmed.
