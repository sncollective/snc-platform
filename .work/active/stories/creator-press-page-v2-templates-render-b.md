---
id: creator-press-page-v2-templates-render-b
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
