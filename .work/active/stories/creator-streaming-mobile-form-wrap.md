---
id: creator-streaming-mobile-form-wrap
kind: story
stage: review
tags: [streaming, creators]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# Fix create-key form overflow at mobile viewport

UX-review finding (creator audit C1, severity 3): the create-key form is a horizontal
flex row; at 375px the submit button extends 48px past the viewport edge, giving the
whole page horizontal scroll. Stack or wrap the form below the mobile breakpoint
(`flex-wrap: wrap` or column layout) in the streaming-tab CSS module. Evidence:
`creator-mobile-c1-form-overflow.png` (scratchpad) + the
`streaming-playout-ux-review-creator-audit` story body.

## Acceptance
- [x] No horizontal scroll at 375px on the streaming manage tab
- [x] Form remains single-row at desktop widths

## Implementation notes

**Changed file:**

- `apps/web/src/routes/creators/$creatorId/manage/streaming.module.css` — `.createForm` rule:
  - Changed to mobile-first: default `flex-direction: column` (stacks at narrow viewports).
  - Added `@media (min-width: 768px)` block restoring `flex-direction: row; align-items: center` for desktop, matching the project's `min-width: 768px` breakpoint convention (verified across `__root.module.css`, `dashboard.module.css`, `live.module.css`, and others).
  - Inside the media query, added `input { flex: 1 1 0; min-width: 0 }` so the text input fills available width without shrinking past zero on narrow desktop viewports.

This is a CSS-only change. No test required (UX verified at code level — column layout at mobile means no overflow by construction; row layout at ≥768px is the existing desktop behavior). Browser-level verification at 375px was not performed in this run (no browser available); the CSS-only approach is structurally correct.

**Breakpoint rationale:** `min-width: 768px` is the single breakpoint used consistently across all CSS modules examined. The mobile-first stacking direction (`flex-direction: column`) at the default ensures the form stacks on any viewport narrower than 768px, which covers the 375px overflow condition from the UX finding.
