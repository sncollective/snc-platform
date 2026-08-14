---
id: brand-token-architecture-alias-migration
kind: story
stage: done
tags: [design-system]
parent: brand-token-architecture
depends_on: [brand-token-architecture-leak-cleanup, brand-token-architecture-font-loading]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Token foundation — migrate consumers + retire aliases

## Brief

Migrate all color/font/radius consumers to the one-owner vocabulary; delete compatibility
aliases and old token files; publish the conventions draft into `platform-patterns.md` + the
AGENTS.md CSS section. The org-constrained public-chart palette is a hard dependency of
completion: the temporary `--legacy-public-chart-*` bridge may exist during leak cleanup but
must be replaced and deleted here. Run the all-syntax no-leak rule and org-mirrored visual /
contrast matrix.

## Acceptance

- **Vocabulary deletion:** all consumers use the new vocabulary; no compatibility alias or
  old `color.css`/shadow alias remains; `global.css` imports only `tokens/index.css`.
- **Public-chart hard gate:** acceptance fails while any `--legacy-public-chart-*` definition,
  use, or lint exemption exists. Replace it with the org-delivered palette before claiming
  migration complete.
- **Publish and enforce the spine-vs-voice convention:** update `platform-patterns.md` and
  the AGENTS.md CSS section with the STATE/IDENTITY recipe table, one-owner boundary,
  underline-by-default prose-link rule, and raw-color allowlists; enable the machine rule.
- **All-syntax no-leak proof:** the static checker covers hex, rgb(a), hsl(a), named colors,
  and modern color functions and reports zero non-exempt violations.
- **Visual/contrast proof:** both modes and all voices pass foreground/background and
  foreground/elevated pairs plus base + hover + disabled + tint-composite cases, mirroring
  org's matrix; fixed light/dark preview roles remain invariant across UI modes.

## Implementation notes

- Migrated 329 compatibility font/color/size/elevation references across the authored CSS
  surface, plus seven generic `on-color` uses and 63 unsafe background-as-foreground uses,
  onto route-resolved font/identity roles, semantic spine roles, paired status recipes, and
  `--color-on-accent`. In total, 118 source CSS files changed. Deleted `tokens/color.css`,
  `tokens/legacy/`, the shadow alias, the size alias, and the Inter/Georgia compatibility
  aliases; `global.css` now reaches tokens only through `tokens/index.css`.
- Replaced all 29 public-chart bridge definitions/usages with org's six-series palette plus
  grid and tooltip roles in `tokens/color/data.css`. Emissions actual/projected/offset use
  categorical chart roles; net-positive/net-negative use error/success because they are
  genuinely semantic bad/good series under org's explicit allowance. Revenue uses chart 1
  with chart 2 as its hover distinction. The bridge and every exemption for it are gone.
- Published the spine-vs-voice contract, STATE/IDENTITY recipe, route-resolved consumption
  boundary, prose-link rule, public/internal chart split, and fail-closed raw-color allowlists
  in `.claude/rules/platform-patterns.md` and the `AGENTS.md` CSS convention.
- Extended `color-leaks.test.ts` from authored CSS to CSS-in-TSX: hex, rgb(a), hsl(a), named
  pigments, modern color functions, JSX color attributes, dynamic inline color properties,
  direct voice-token use, and deleted-vocabulary/file checks. Exact exemptions are limited to
  token owners, Simple Icons-derived vendor identity, validated runtime creator-brand
  injection, the reserved signature-chip owner, and semantic CSS keywords; there is no chart
  bridge exemption.
- Extended the contrast harness across both modes and all four voices for shared foregrounds,
  accent/base/hover pairs, disabled and tint composites, all six public chart series (computed
  >=3:1 against chart hosts), chart tooltip AA, and fixed preview-role invariance.
- Verification: `bun run --filter @snc/web test` (192 files, 1,987 tests),
  `bun run --filter @snc/web build`, and the required legacy-vocabulary grep all pass. Build
  emits only the repository's existing third-party `use client` directive warnings.

### Implementation decisions

Direct-read implementation was used because the mapping and consumer-disposition tables were
complete and this checkpoint required one coherent owner. Public chart hover/category choices
stay within the org palette; semantic emissions net direction deliberately reuses status colors
rather than falsely presenting good/bad data as neutral categories. No acceptance deviation or
remaining blocker was found.
