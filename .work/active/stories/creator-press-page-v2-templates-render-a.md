---
id: creator-press-page-v2-templates-render-a
kind: story
stage: done
tags: [creators, content, ui]
parent: creator-press-page-v2-templates
depends_on: [creator-press-page-v2-templates-shared-sections-and-icons, creator-press-page-v2-templates-carousel]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Press templates — render Template A

## Checkpoint

Implement the explicit Clean Editorial composition in
`press-template-a.tsx` + its own CSS module, matching
`.mockups/screens/creator-press-page/final-1.html`:

hero → About → members with bios → first two highlights → Live → Listen →
carousel → press footer. Preserve the centered 980px wordmark/article measure,
3:1 gradient hero, 4:5 floated About image, four/two-column members, two/one-column
highlights, fixed PDF action, mobile breakpoints, credits, and letter print.
Missing media collapses without placeholder cards; the gradient hero remains.

## Acceptance evidence

Render tests prove member bios and the two-highlight limit, section order,
credits/alt/links, and populated plus image-empty states. Visual comparison runs
at desktop/mobile/print against final-1 and pairs with exact email/URL grep.

## Ordering

Requires shared sections and carousel behavior; can proceed in parallel with
Template B after both checkpoints are complete.

## Implementation notes
- Execution capability: direct inline ownership; explicit composition preserved the locked hierarchy without a page DSL.
- Review weight: standard (project default; review occurs at the feature boundary).
- Files changed: `apps/web/src/components/press/press-template-a.tsx`, `press-template-a.module.css`, `press-sections.tsx` exact-optional prop seam, and `apps/web/tests/unit/components/press/press-template-a.test.tsx`.
- Tests added/removed: two render tests for order, bios, two-highlight limit, exact contact/PDF contract, and image-empty collapse; none removed.
- Simplification: Template A is only composition; shared sections retain all semantics and item rendering.
- Discrepancies from design: none.
- Visual verification: populated screenshots at 1440/760/480/390 matched the locked centered 980px editorial measure, 3:1 hero, four/two member grid, two/one highlights, five-service icon row, carousel peek/arrows, and fixed PDF action with no visible horizontal overflow. A 390px all-image-empty screenshot kept the gradient hero and clean text-only cards with no broken image icons. Firefox BiDi letter-print output was visually inspected: letter size, fixed action/arrows hidden, static 4:3 gallery, credits retained, and full content continued across three pages rather than being truncated per the deferred overflow policy.
- Exact-string verification: `press@s-nc.org`, `mailto:press@s-nc.org`, service registry members, `translate3d`, ArrowLeft/ArrowRight, and slot ratios all matched source; no `press@snc.org` literal.
- Verification: focused A/B/component/route tests (29 passed) and web typecheck (0 errors).
- Adjacent issues parked: none.
