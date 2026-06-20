---
id: calendar-task-checkbox-bug
kind: backlog
tags: [calendar, creators, bug]
created: 2026-04-20
updated: 2026-06-20
---

# Calendar task checkbox non-functional in creator-manage timeline

Logged 2026-03-21 as a vague "checkbox bug"; scoped 2026-06-20 by a code-grounding pass. The
symptom is a **dead checkbox**, and it's two distinct gaps that compound — not the dropped-PATCH-
field pattern seen with `visibility`.

## What actually happens (grounded)

The task-completion checkbox is rendered by the shared `EventCard`
(`apps/web/src/components/calendar/event-card.tsx:62-68`; checked = `completedAt !== null`,
fires `onToggleComplete?.(event.id)`). It works in two of the three timeline surfaces and is
dead in the third:

| Surface | Route | Toggle wired? |
|---|---|---|
| Governance calendar timeline | `/governance/calendar` | works |
| Project detail timeline | `/creators/$id/manage/projects/$slug` | works |
| **Creator-manage calendar timeline** | `/creators/$id/manage/calendar` | **dead** |

(Month-grid views render event *pills*, not checkboxes — so this is timeline-only. The original
report's "month grid" mention is a red herring.)

### Gap 1 — handler not passed (the visible symptom)

`apps/web/src/routes/creators/$creatorId/manage/calendar.tsx:131` renders `<TimelineView>`
**without** an `onToggleComplete` prop, so the checkbox renders but clicking does nothing (no
call, no error). The local `cal` controller does expose a toggle (`handleToggleComplete`), it's
just not wired through.

### Gap 2 — no creator-scoped completion endpoint (latent)

Even with the handler wired, the web client `toggleEventComplete`
(`apps/web/src/lib/calendar.ts:46-54`) always calls `PATCH /api/calendar/events/:id/complete`.
That global endpoint exists (`apps/api/src/routes/calendar.routes.ts:377-425`, correct
toggle-null↔now logic) but `creator-events.routes.ts` has **no `/complete` route** — only POST
(184) / PATCH (247) / DELETE (315). Whether Gap 2 actually bites depends on whether the
creator-manage calendar's events are fetched creator-scoped or via the global calendar API —
**confirm at implement time** which API backs `/creators/$id/manage/calendar` before deciding
whether the global endpoint suffices or a creator-scoped `/complete` must be added.

## Scope (to confirm at implementing)

1. Wire `onToggleComplete` into `<TimelineView>` at `manage/calendar.tsx:131` (mirror the
   governance + project-detail call sites).
2. Determine which API the creator-manage calendar's task events come from. If creator-scoped:
   add `PATCH /:creatorId/events/:eventId/complete` to `creator-events.routes.ts` (copy the
   pattern from `calendar.routes.ts:377-425`) + a route to it in `lib/calendar.ts`. If global:
   Gap 1 alone fixes it.
3. Regression tests: a web test that the manage-calendar checkbox calls the toggle (mirror
   `event-card.test.tsx:121-172`); if an endpoint is added, an API happy-path + non-task-reject
   test mirroring `calendar.routes.test.ts:497-563`.

## Notes

- `UpdateCalendarEventSchema` omits `completedAt` by design (toggle-only via the dedicated
  endpoint, no arbitrary date-set) — not a bug, leave it.
- This is **user-verifiable** (fix-verify loopback applies): toggle a task in the creator-manage
  timeline and confirm it persists across reload.
