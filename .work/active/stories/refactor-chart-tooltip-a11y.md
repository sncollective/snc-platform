---
id: refactor-chart-tooltip-a11y
kind: story
stage: done
tags: [refactor, accessibility, emissions]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-04-20
updated: 2026-06-13
parent: null
---

Make the emissions chart tooltip keyboard-accessible by adding focus-visible triggers on chart data points and an ARIA live region so screen readers announce tooltip content.

## Scope

- `apps/web/src/components/emissions-chart.tsx` (332 LOC) — the chart currently reveals its tooltip on hover only. Add focus-visible event handling to chart bars/points so keyboard users can reach the same data. Add an ARIA live region (`aria-live="polite"`) that receives the tooltip content when it becomes visible, enabling screen reader announcement.

## Tasks

- [x] Add `onFocus` / `onBlur` handlers to each chart bar or data point element, mirroring the existing `onMouseEnter` / `onMouseLeave` show/hide logic.
- [x] Ensure the focusable elements have `tabIndex={0}` and a meaningful `aria-label` describing the data point (e.g. "March 2026: 4.2 kg CO₂").
- [x] Add an ARIA live region element (hidden visually, present in the DOM) that is populated with the tooltip text on focus/hover.
- [x] Verify with keyboard navigation: Tab through bars, tooltip appears on focus, disappears on blur, screen reader text updates via live region.

## Notes

The chart is hand-rolled SVG (noted in the board as a candidate for recharts, but that's a separate backlog item). Work within the existing SVG/DOM structure; do not introduce recharts as part of this story. If SVG `<rect>` or `<circle>` elements are used for the bars/points, they support `tabIndex` and keyboard events natively in modern browsers. The ARIA live region should sit outside the SVG element in the surrounding HTML so it is reliably read by screen readers (SVG ARIA support varies by browser/reader combination).

## Implementation notes

- Renamed `hoveredIndex` → `activeIndex` (now shared by both mouse and keyboard paths).
- Added `onFocus` / `onBlur` to the existing hover-target `<circle>` elements (mirroring `onMouseEnter` / `onMouseLeave`).
- Each circle now carries `tabIndex={0}`, `role="button"`, and a computed `aria-label` of the form `"Jan 2026: Actual 10 kg, Projected 10 kg, Offsets 0 kg, Net 10 kg"`.
- Added a visually-hidden `aria-live="polite" aria-atomic="true"` `<div>` outside the SVG that mirrors the tooltip text when any data point is active and clears when none is active. Placed outside SVG per story guidance (SVG ARIA support varies by browser/reader).
- Added `.srOnly` to `emissions-chart.module.css` (standard visually-hidden pattern; no global token required since this is component-owned).
- Actual file changed: `apps/web/src/components/emissions/emissions-chart.tsx` (actual path — story scope had a minor path discrepancy: component lives under `emissions/` subdirectory, not directly under `components/`).
- CSS change: `apps/web/src/components/emissions/emissions-chart.module.css` — added `.srOnly` block only.
- Tests: 7 new tests added to `apps/web/tests/unit/components/emissions/emissions-chart.test.tsx` (pre-existing: 10; total: 17). All 1716 web tests pass.

## Review (2026-06-13)
**Verdict**: Approve — fast-lane advance. a11y enrichment (tabIndex/role/aria-label per
data point + aria-live mirror outside the SVG); component-owned .srOnly; 7 new tests; 1716
web tests pass. Minor story-path discrepancy (component under emissions/ subdir) noted in
record, not a defect.
