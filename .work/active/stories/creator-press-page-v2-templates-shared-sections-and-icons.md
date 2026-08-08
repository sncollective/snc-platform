---
id: creator-press-page-v2-templates-shared-sections-and-icons
kind: story
stage: done
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

## Implementation notes
- Execution capability: direct inline ownership; cohesive React primitives shared by both locked compositions.
- Review weight: standard (project default; review occurs at the feature boundary).
- Files changed: `apps/web/src/components/press/press-types.ts`, `press-image.tsx`/CSS, `press-sections.tsx`/CSS, `streaming-icons.tsx`, `streaming-services.tsx`/CSS, and press fixture/section tests.
- Tests added/removed: five semantic render tests covering populated/sparse content, credits, labels, service inference, link safety, and exact `mailto:press@s-nc.org`; none removed.
- Simplification: image rendering, optional-section omission, outbound-link policy, and service glyph dispatch are each single-sourced.
- Discrepancies from design: web-local delivered types mirror the API projection because the operator prohibited edits to the completed shared contract.
- Verification: focused web tests (5 passed) and web typecheck (0 errors).
- Adjacent issues parked: none.
