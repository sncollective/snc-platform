---
id: creator-press-page-v2-templates-shared-sections-and-icons
kind: story
stage: implementing
tags: [creators, content, ui]
parent: creator-press-page-v2-templates
depends_on: [creator-press-page-v2-templates-image-projection]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Press templates — shared semantic sections and icons

## Checkpoint

Build the shared presentational contract used by both locked templates under
`apps/web/src/components/press/`:

- delivered press image/figure with responsive sources, required alt, optional
  caption or burn-in credit, and null-safe empty behavior;
- About, Members, Highlights, Live dates/link-out, Listen, and footer sections;
- typed icon registry covering every `PressStreamingService`, with the five
  locked SVG paths and generic website fallback;
- token-only co-located CSS modules matching the locked 980px measure, type,
  spacing, pills, cards, links, responsive rows, and print treatment.

The shared renderers accept explicit choices (`showBio`, highlight limit) rather
than knowing which template called them. Live dates accept optional rows but the
current route supplies only `liveDatesUrl`.

## Acceptance evidence

- Populated render tests cover semantics, credits, labels, service inference,
  outbound-link safety, and A/B options.
- Sparse render test proves no broken `<img>`, empty section heading, invented
  content, or literal null when every image is absent.
- Exact-string assertion uses `mailto:press@s-nc.org`, never `press@snc.org`.

## Ordering

Consumes the delivered-image public payload established by
`creator-press-page-v2-templates-image-projection`.
