---
id: creator-streaming-mobile-form-wrap
kind: story
stage: implementing
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
- [ ] No horizontal scroll at 375px on the streaming manage tab
- [ ] Form remains single-row at desktop widths
