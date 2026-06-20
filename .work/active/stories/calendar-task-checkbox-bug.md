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

### Follow-up: the headline scenario was still 403'd (review catch)

Code review caught that the new endpoint — like every handler in `creator-events.routes.ts` —
sat behind a router-level `requireRole("stakeholder", "admin")` middleware that ran *before* the
per-handler `requireCreatorPermission`. So the exact scenario this story set out to fix (a
creator-team member managing their own page who holds **no** org stakeholder/admin role) still
hit a 403 at the middleware. The fix mirrored the broken siblings faithfully — but the siblings
were broken the same way.

**Resolved:** removed the blanket `requireRole` from the router. Authorization for creator
events is now per-creator only — each handler's `requireCreatorPermission(..., "manageScheduling",
...)` is the sole authority (it admits creator owners/editors and bypasses for org admins). The
GET list handler, which previously relied *solely* on the blanket guard (no per-creator check of
its own), gained an explicit `requireCreatorPermission` so removing the middleware did not turn a
403 into a cross-creator data leak. This is the intended product behavior: **creator members
manage their own calendars without needing an org-wide role.**

*Revisit if* a viewer-facing (read-only) creator calendar is ever added — the GET handler is
gated on `manageScheduling`, so it would need loosening to `viewPrivate` for a viewer surface.

## Verification

- API 1787/1787 (5 toggle-endpoint tests: toggle on, toggle off, non-task 400, cross-creator
  404, manageScheduling 403; plus a reworked GET test proving a creator member with `roles: []`
  now gets 200 and a non-member gets 403 — the headline scenario, which the old role-based GET
  test could not exercise). Web 1767/1767. `tsc` clean both packages.

## Notes

- `UpdateCalendarEventSchema` omits `completedAt` by design (toggle-only via the dedicated
  endpoint, no arbitrary date-set) — left as-is.

## Fix-verify loopback (pending)

In the running app at `/creators/$id/manage/calendar`, timeline view: sign in as a creator-team
**owner or editor who holds no org stakeholder/admin role**, toggle a task event's checkbox, and
confirm it persists across reload (no 403). This is now the load-bearing case — it was the
scenario the original fix did not actually unblock. Story stays at `stage: review` until confirmed.
