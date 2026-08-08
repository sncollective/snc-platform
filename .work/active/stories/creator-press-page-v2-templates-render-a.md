---
id: creator-press-page-v2-templates-render-a
kind: story
stage: implementing
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
