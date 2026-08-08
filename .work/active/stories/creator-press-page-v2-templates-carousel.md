---
id: creator-press-page-v2-templates-carousel
kind: story
stage: implementing
tags: [creators, content, ui]
parent: creator-press-page-v2-templates
depends_on: [creator-press-page-v2-templates-shared-sections-and-icons]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Press templates — gallery carousel

## Checkpoint

Implement `press-carousel.tsx` and its own CSS module to translate the locked
mockup behavior into React:

- `translate3d` track with measured slide+gap stride and true max-offset clamp;
- prev/next disabled states, ArrowLeft/ArrowRight on a focusable labelled
  viewport, and no Tab trapping;
- responsive 3.25 / 2.2 / 84%-width slides and no page overflow;
- resize reconciliation/cleanup, reduced motion, and static 4:3 print layout;
- gallery images/credits through the shared press-image renderer; empty input
  returns null.

## Acceptance evidence

Geometry-controlled component tests prove stride, final partial move, clamp,
disabled states, keyboard behavior, resize, and cleanup. Visual verification at
1440/760/480/390 confirms the partially peeking next slide and absence of
horizontal page overflow; print has no controls or transform.

## Ordering

Depends on the shared delivered-image/section contract.
