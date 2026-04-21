---
id: feature-refactor-component-splitting-oversized-files
kind: feature
stage: implementing
tags: [refactor, structural]
release_binding: null
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

Seven frontend files have grown beyond their natural single-responsibility boundary — mixing form state, UI sections, hooks, and utilities in one file. Files with 9-18 `useState` calls in a single component are candidates for `useReducer`-based consolidation or hook extraction. Files mixing distinct UI concerns (profile editing, uploads, social links; broadcast status, polling hook, utility) are candidates for sub-component extraction. Splitting reduces cognitive load, enables targeted testing, and makes the files navigable without scrolling.

## Scope

React components and hooks in `apps/web/src/` that exceed size or complexity thresholds. Each task below is a distinct file with its own extraction strategy.

## Tasks

- [ ] `apps/web/src/routes/creators/$creatorId/manage/settings.tsx` (423 LOC, 15 useState) — split into profile-edit, uploads, and social-links sub-components; the three concerns are currently interleaved
- [ ] `apps/web/src/routes/creators/$creatorId/manage/event-form.tsx` (648 LOC, 18 useState) — extract schema to `event-form.schema.ts`, form state to `use-event-form.ts`, date/time section to `date-time-section.tsx`
- [ ] `apps/web/src/routes/creators/$creatorId/manage/calendar.tsx` (234 LOC) — split after `event-form.tsx` extraction completes; shared concerns between the two files make this order-dependent
- [ ] `apps/web/src/components/emissions-chart.tsx` (332 LOC) — split into GridLines, DataLines, Legend, and Tooltip sub-components (note: recharts as an alternative to hand-rolled SVG is a separate backlog item; split regardless of that decision)
- [ ] `apps/web/src/routes/creators/$creatorId/manage/team-section.tsx` (350 LOC, 9 useState) — candidate for `useReducer` to consolidate related state; note `as unknown as never` cast at lines 149, 288, 521 for ArkUI v5 invariant (tracked separately, not blocking the split)
- [ ] `apps/web/src/routes/admin/playout.tsx` (387 LOC) — extract `BroadcastStatus` component, `usePlayoutStatus` hook, and `formatSeconds` utility; all three are independently testable
- [ ] `apps/web/src/hooks/use-content-management.ts` (200 LOC, 10 useState) — refactor with `useReducer` to consolidate the async-state flags; reduces state variable count and makes state transitions explicit

## Notes

`calendar.tsx` depends on `event-form.tsx` extraction — do not split calendar independently. `admin/playout.tsx` extraction of `usePlayoutStatus` creates a candidate for later consolidation with the identical `mountedRef` + recursive `setTimeout` polling pattern in `live.tsx` (tracked as a separate backlog practice item). Actual file paths may vary from the paths listed here — verify against current source before extracting.
