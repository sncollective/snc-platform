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

Install the six Fontsource families using the consumer-verified manifest in
`brand-token-architecture` → `## Design — Font-loading plan`: Source Sans 3 Roman 400–900 +
true italic 400–600; Newsreader Roman 400–700; Saira Roman 400–700 + true italic 400;
Archivo Roman 400–700; Barlow Condensed Roman 400–700 (including its verified 400 display
consumers); Fragment Mono Roman 400. Use latin + latin-ext without hand-trimmed ranges,
verify required glyph cmaps/rendering, preload only Source Sans 3 Roman, and remove the Google
Inter dependency. Use the exact plain named fallback stacks; metric overrides remain deferred
until measured CLS evidence exists.

## Acceptance

- Six families load from own-origin Fontsource assets with exactly the manifest's
  Roman/italic coverage; real italic renders for current Source Sans and Saira consumers and
  `font-synthesis: none` prevents synthetic italics.
- Exact fallback stacks match the feature table. No `size-adjust`/ascent/descent override is
  invented; add one only in a later evidence-backed change if measured CLS justifies it.
- `latin` + `latin-ext` assets are present without manual over-subsetting; cmap + rendered
  fixtures verify U+00B7 (`24·96`), U+25CF (`● LIVE`), Latin-ext creator names, and named
  fallback coverage for creator scripts absent from the primary family.
- Source Sans 3 Roman alone is preloaded; voice/italic faces load on demand; offline dev has
  no Google or other font-network request.
- Legacy Inter + Georgia aliases remain only until `alias-migration`.

## Implementation discovery

- Added Fontsource 5.3.0 packages for Source Sans 3, Newsreader, Saira, Archivo,
  static Barlow Condensed, and Fragment Mono. `fonts.css` imports the approved
  Roman/italic faces; generated Fontsource unicode ranges retain latin + latin-ext
  coverage without hand-trimmed ranges. The document contract sets
  `font-synthesis: none` and all generated faces use `font-display: swap`.
- The registry does not publish `@fontsource-variable/barlow-condensed`; the
  implementation uses the generated static 400/500/600/700 files from
  `@fontsource/barlow-condensed` as the faithful 400–700 fallback. This is a
  package availability constraint, not a design change, and should be revisited
  if Fontsource publishes the variable package.
- The root route preloads only the hashed Source Sans 3 Roman WOFF2 and removes
  the Google Inter stylesheet/preconnects. Existing Inter and Georgia aliases
  remain for the alias-migration checkpoint.
- Font tests inspect actual WOFF2 cmaps through `fc-query`: U+00B7 is present in
  each manifest face, while U+25CF is intentionally supplied by the named Arial
  fallback (the primary subsets do not contain it). The `● LIVE` fixture and
  fallback cmap are verified; this is a Linux/CI fontconfig-backed cmap check,
  not a browser pixel-rendering test.
