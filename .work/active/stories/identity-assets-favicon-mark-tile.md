---
id: identity-assets-favicon-mark-tile
kind: story
stage: done
tags: [design-system, ui]
parent: identity-assets-pass
depends_on: []
release_binding: null
gate_origin: identity-assets-pass checkpoint
created: 2026-08-15
updated: 2026-08-15
---

# Favicon mark tile

Replace the generic S tile with the brush-script identity mark on the shared spine values.
Use a reduced slash-only mark below 24px, the full lockup at larger sizes, and preserve PNG
fallbacks for browsers that do not use SVG favicons.

## Acceptance

- The SVG responds to the browser's light/dark preference using papyrus and cast60.
- Exact 16, 32, 48, and 180px captures exist and a vision-capable reviewer evaluates them.
- The head advertises SVG, 16/32px PNG, and 180px Apple touch assets.
- The web test/build pass and served HTML contains the icon links.

## Implementation notes

- Execution capability: `gpt-5.6-sol` (caller-selected; small asset surface with high visual-risk verification).
- Review weight: standard (project default).
- Files changed: `apps/web/public/favicon.svg`, theme-specific PNG fallbacks under `apps/web/public/`, and favicon links in `apps/web/src/routes/__root.tsx`.
- Tests added/removed: none; exact asset dimensions, source/head assertions, and served HTML exercise the stable boundary directly.
- Simplification: the existing generic text glyph tile is replaced in place; no legacy `.ico`/PNG chain existed.
- Design decision: use the extracted sweeping slash below 24px because the complete six-path lockup carries more detail than a 16px tile can reliably preserve; retain the full lockup from 32px upward.
- Visual evidence: Chromium rendered both schemes at exact 16/32/48/180px into `/tmp/identity-favicon-review/`. The first vision pass confirmed the slash tier but found the full lockup pressed against the tile edge; the full mark gained a proportional 5% safe area, and the final `gpt-5.6-sol` vision pass returned PASS for legibility, contrast, centering, clipping, and tier correctness at every size.
- Verification: `bun run --filter @snc/web test` (197 files, 2057 tests), `bun run --filter @snc/web build`, source/head asset assertions, and live SSR at `127.0.0.1:3001` containing all SVG/PNG/touch icon links passed.
- Discrepancies from design: PNG fallbacks were added rather than adjusted because the head previously linked only the SVG.
- Adjacent issues parked: none.
