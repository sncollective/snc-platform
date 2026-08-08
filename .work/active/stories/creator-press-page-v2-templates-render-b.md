---
id: creator-press-page-v2-templates-render-b
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

# Press templates — render Template B

## Checkpoint

Implement the explicit Two-Column Zone composition in
`press-template-b.tsx` + its own CSS module, matching
`.mockups/screens/creator-press-page/final-3.html`:

shared hero/About → elevated .95fr/1.05fr mid-zone with two-column names-only
members and first three vertical highlights → Live → Listen → carousel → press
footer. Stack the zone below 820px, retain two member columns and 92px highlight
art below 480px, and restore locked two-column geometry in letter print. Fewer
items compact; no empty cards are synthesized.

## Acceptance evidence

Render tests prove member bios are absent from the DOM, only three ordered
highlights render, sparse arrays compact, and shared semantics/credits remain.
Visual comparison runs at desktop/mobile/print against final-3 and pairs with
exact email/URL grep.

## Ordering

Requires shared sections and carousel behavior; can proceed in parallel with
Template A after both checkpoints are complete.

## Implementation notes
- Execution capability: direct inline ownership; the explicit mid-zone is a bounded layout shell over shared semantics.
- Review weight: standard (project default; review occurs at the feature boundary).
- Files changed: `apps/web/src/components/press/press-template-b.tsx`, `press-template-b.module.css`, and `apps/web/tests/unit/components/press/press-template-b.test.tsx`.
- Tests added/removed: two render tests for names-only DOM, three-highlight limit, exact contact, and sparse compaction; none removed.
- Simplification: B owns only the `.95fr / 1.05fr` shell and delegates every semantic item renderer.
- Discrepancies from design: none.
- Visual verification: populated screenshots at 1440/760/480/390 matched the locked centered two-column zone, two-by-two names-only members, three vertical highlights, below-820px stack, five-service icons, responsive carousel peek, and fixed PDF action with no visible horizontal overflow. The 1440px all-image-empty screenshot retained balanced text-only zone geometry without broken images. Firefox BiDi letter-print output was visually inspected: the `.95fr / 1.05fr` zone returned to two columns, controls/fixed action disappeared, gallery became static, credits remained, and full content continued onto a second page under the deferred overflow policy.
- Exact-string verification: `press@s-nc.org`, `mailto:press@s-nc.org`, service registry members, `translate3d`, ArrowLeft/ArrowRight, and slot ratios all matched source; no `press@snc.org` literal.
- Verification: focused A/B/component/route tests (29 passed) and web typecheck (0 errors).
- Adjacent issues parked: none.
