---
id: story-refactor-chart-tooltip-a11y
kind: story
stage: implementing
tags: [refactor, accessibility, emissions]
release_binding: null
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

Make the emissions chart tooltip keyboard-accessible by adding focus-visible triggers on chart data points and an ARIA live region so screen readers announce tooltip content.

## Scope

- `apps/web/src/components/emissions-chart.tsx` (332 LOC) — the chart currently reveals its tooltip on hover only. Add focus-visible event handling to chart bars/points so keyboard users can reach the same data. Add an ARIA live region (`aria-live="polite"`) that receives the tooltip content when it becomes visible, enabling screen reader announcement.

## Tasks

- [ ] Add `onFocus` / `onBlur` handlers to each chart bar or data point element, mirroring the existing `onMouseEnter` / `onMouseLeave` show/hide logic.
- [ ] Ensure the focusable elements have `tabIndex={0}` and a meaningful `aria-label` describing the data point (e.g. "March 2026: 4.2 kg CO₂").
- [ ] Add an ARIA live region element (hidden visually, present in the DOM) that is populated with the tooltip text on focus/hover.
- [ ] Verify with keyboard navigation: Tab through bars, tooltip appears on focus, disappears on blur, screen reader text updates via live region.

## Notes

The chart is hand-rolled SVG (noted in the board as a candidate for recharts, but that's a separate backlog item). Work within the existing SVG/DOM structure; do not introduce recharts as part of this story. If SVG `<rect>` or `<circle>` elements are used for the bars/points, they support `tabIndex` and keyboard events natively in modern browsers. The ARIA live region should sit outside the SVG element in the surrounding HTML so it is reliably read by screen readers (SVG ARIA support varies by browser/reader combination).
