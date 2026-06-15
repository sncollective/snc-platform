---
id: refactor-component-splitting-oversized-files
kind: feature
stage: review
tags: [refactor, structural]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-04-20
updated: 2026-06-15
parent: null
---

Seven frontend files have grown beyond their natural single-responsibility boundary — mixing form state, UI sections, hooks, and utilities in one file. Files with 9-18 `useState` calls in a single component are candidates for `useReducer`-based consolidation or hook extraction. Files mixing distinct UI concerns (profile editing, uploads, social links; broadcast status, polling hook, utility) are candidates for sub-component extraction. Splitting reduces cognitive load, enables targeted testing, and makes the files navigable without scrolling.

## Scope

React components and hooks in `apps/web/src/` that exceed size or complexity thresholds. Each task below is a distinct file with its own extraction strategy.

## Tasks

- [ ] `apps/web/src/routes/creators/$creatorId/manage/settings.tsx` (423 LOC, 15 useState) — split into profile-edit, uploads, and social-links sub-components; the three concerns are currently interleaved
- [ ] `apps/web/src/routes/creators/$creatorId/manage/event-form.tsx` (648 LOC, 18 useState) — extract schema to `event-form.schema.ts`, form state to `use-event-form.ts`, date/time section to `date-time-section.tsx`
- [ ] `apps/web/src/routes/creators/$creatorId/manage/calendar.tsx` (234 LOC) — split after `event-form.tsx` extraction completes; shared concerns between the two files make this order-dependent
- [x] `apps/web/src/components/emissions/emissions-chart.tsx` (path corrected — file moved into `emissions/` subdir; was `components/emissions-chart.tsx`, now 353 LOC) — split into GridLines, DataLines, Legend, and Tooltip sub-components (done 2026-06-15; behavior-preserving presentational decomposition). The chart-math layer was already factored to `lib/chart-math.ts` in earlier work, so this task narrowed to the presentational split. Note: recharts as an alternative to hand-rolled SVG is a separate backlog item; split done regardless of that decision.
- [ ] `apps/web/src/routes/creators/$creatorId/manage/team-section.tsx` (350 LOC, 9 useState) — candidate for `useReducer` to consolidate related state; note `as unknown as never` cast at lines 149, 288, 521 for ArkUI v5 invariant (tracked separately, not blocking the split)
- [x] `apps/web/src/routes/admin/playout.tsx` — extract `BroadcastStatus` component, `usePlayoutStatus` hook, and `formatSeconds` utility (all three done). `BroadcastStatus` was already a standalone (co-located) component with its own `describe` test block; the polling hook was already extracted to `hooks/use-polling.ts` (generic `usePolling<T>`, wrapped by a local `useChannelQueue`) in commit c59818f; `formatSeconds` de-duplicated to `lib/format-duration.ts` (done 2026-06-15) — was inline in both `playout.tsx` and `components/admin/queue-item-row.tsx`.
- [ ] `apps/web/src/hooks/use-content-management.ts` (201 LOC, 9 useState) — `useReducer` consolidation DROPPED from this sweep (not behavior-preserving + unguarded). Re-scope through normal design with a test-first step — see Implementation note below.

## Notes

`calendar.tsx` depends on `event-form.tsx` extraction — do not split calendar independently. `admin/playout.tsx` extraction of `usePlayoutStatus` creates a candidate for later consolidation with the identical `mountedRef` + recursive `setTimeout` polling pattern in `live.tsx` (tracked as a separate backlog practice item). Actual file paths may vary from the paths listed here — verify against current source before extracting.

## Implementation (2026-06-15)

Re-grounded all seven task paths against current code before touching anything; the 2026-04-20 plan had drifted. Two behavior-preserving sub-tasks remained open across the three owned files (`emissions-chart.tsx`, `use-content-management.ts`, `admin/playout.tsx`) and were implemented; the rest were already done, out of scope, or dropped as not-clearly-behavior-preserving.

### Done

**1. emissions-chart presentational split** — `apps/web/src/components/emissions/emissions-chart.tsx` (353 LOC; the item's `components/emissions-chart.tsx` path was stale — the file had moved into the `emissions/` subdir). The math layer was already factored to `lib/chart-math.ts` in earlier work, so this narrowed to a pure presentational decomposition. `EmissionsChart` stays the orchestrator: it owns the `activeIndex` `useState`, computes all geometry (`xForIndex`/`yForValue`/`makePolyline` closures, `ticks`, `gridValues`, `netSegments`, `lastActualIndex`, `labelInterval`), and keeps the `aria-label` string and the ARIA live region (outside the SVG, by design). Extracted four co-located presentational sub-components that take already-computed geometry as props and emit byte-identical SVG: `ChartGridlines` (gridlines + y-axis labels + zero line), `ChartDataLines` (actual polyline, projected segments, offset dots, net segments, hover/focus targets, x-axis labels), `ChartTooltip`, `ChartLegend`. SVG element order and attributes preserved exactly; all `!` non-null assertions and slicing logic carried over verbatim. Public surface frozen: `EmissionsChartProps` unchanged, the three re-exports (`MonthlyDataItem`, `ChartLines`, `computeChartLines`) unchanged. JSDoc one-liner on each sub-component per `inline-documentation.md` (Recommended tier).

**2. formatSeconds de-duplication** — the `H:MM:SS` / `MM:SS` formatter was duplicated byte-identically in `apps/web/src/routes/admin/playout.tsx` and `apps/web/src/components/admin/queue-item-row.tsx`. Lifted the single implementation to a new shared util `apps/web/src/lib/format-duration.ts` (named export `formatSeconds`, JSDoc one-liner — `lib/` utility, cross-module use → Recommended tier), imported it in both consumers, deleted both inline copies. No behavior change.

### Already done (no action)

- **playout `BroadcastStatus` extract** — already a standalone (co-located) component at `playout.tsx` with its own `describe('BroadcastStatus')` test block. Pulling it to a separate file is cosmetic file-shuffling, not the structural win the item described.
- **playout `usePlayoutStatus` hook extract** — already extracted under a different shape: the polling hook lives in `hooks/use-polling.ts` (generic `usePolling<T>`, commit c59818f), and `playout.tsx` wraps it in a clean local `useChannelQueue`. `live.tsx` also consumes the shared `usePolling` — the consolidation the item's Notes anticipated already landed.

### Dropped

- **use-content-management `useReducer` consolidation** — `apps/web/src/hooks/use-content-management.ts` (201 LOC, 9 `useState`, no `useReducer` — the smell is technically still present). Dropped from this behavior-preserving sweep because (a) the item frames it as "reduces state variable count / makes transitions explicit" — a code-shape preference, not a structural decomposition; (b) collapsing 9 independent `useState` into one `useReducer` changes batching/identity semantics (the `editCallbacks` `useMemo` deps and the per-callback dep arrays; `cancelEditing`'s multi-set becomes one dispatch, so observable re-render timing differs) in ways easy to make subtly behavior-different; (c) there is **no** direct unit test for the `useContentManagement` hook (only a `ContentManagementList` component test that doesn't drive it), so the black-box guardrail the other tasks relied on is absent. Without a test harness pinning the hook's observable behavior, a `useReducer` rewrite can't be verified behavior-identical. Re-scope through normal design with a test-first step, not this sweep.

### Out of scope for this pass

The four creator-manage tasks (`settings.tsx`, `event-form.tsx`, `calendar.tsx`, `team-section.tsx`) were not part of the three named owned files for this implementation and were not evaluated against current code here.

### Tests

Established a green baseline (48 tests across the three affected suites) before changes. After both changes:
- Three affected suites: 48/48 green (18 emissions-chart + 26 playout + 4 queue-item-row).
- Full `@snc/web` unit suite: **1737/1737 passing** (158 files) — baseline count held.
- `bunx tsc --noEmit` (apps/web): clean (0 errors). The generated `routeTree.gen.ts` is gitignored and was absent in the fresh worktree; tsc errors vanish once it's present — none of them touch the changed files.

No new tests were required (existing coverage is the guardrail for the behavior-preserving split). A direct unit test for `format-duration.ts` is optional and was not added — `queue-item-row.test.tsx` already exercises the formatter's output (`est. 1:30:00`, `est. 00:01`).
