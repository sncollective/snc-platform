---
id: creator-press-page-v2-templates-carousel
kind: story
stage: done
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

## Implementation notes
- Execution capability: direct inline ownership; geometry and cleanup were the one interaction-risk unit.
- Review weight: standard (project default; review occurs at the feature boundary).
- Files changed: `apps/web/src/components/press/press-carousel.tsx`, `press-carousel.module.css`, and `apps/web/tests/unit/components/press/press-carousel.test.tsx`.
- Tests added/removed: three geometry-controlled tests for measured stride, partial final clamp, keyboard controls, resize reconciliation, fit state, empty input, and observer cleanup; none removed.
- Simplification: one `renderPosition` path serves initial layout, navigation, and resize clamping.
- Discrepancies from design: visual carousel verification is carried with the populated A/B assembled render passes, where page overflow and responsive peeking can be observed accurately.
- Verification: focused carousel tests (3 passed); integrated typecheck deferred only while the concurrent image-management worker has an uncommitted exact-optional-property error in its separately owned `press-crop-editor.tsx`.
- Adjacent issues parked: none.
