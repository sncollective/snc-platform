---
id: brand-token-architecture-font-loading
kind: story
stage: implementing
tags: [design-system]
parent: brand-token-architecture
depends_on: [brand-token-architecture-voice-accents]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Token foundation — Fontsource font loading

## Brief

Install the six families via Fontsource (per `brand-token-architecture` →
`## Design — Font-loading plan`):
`@fontsource-variable/{source-sans-3,newsreader,saira,archivo,barlow-condensed}` + static
`@fontsource/fragment-mono`; import selectively (latin subset + needed weights). Layer
fallback-metric `@font-face` blocks in `tokens/fonts.css` (size-adjust / ascent-override over
generic families) for layout-stable swapping. Preload only Source Sans 3. Preserve special
glyphs (`24·96`, `● LIVE`, creator names) in subsets. Remove the Google Inter dependency at
`__root.tsx:49-59`.

## Acceptance

- Six families load via Fontsource from own origin; no Google font requests.
- Fallback-metric overrides minimize layout shift (measured).
- Source Sans 3 preloaded; voice fonts on-demand.
- Offline dev works; special glyphs render.
- Legacy Inter + Georgia aliases retained only until `alias-migration`.
