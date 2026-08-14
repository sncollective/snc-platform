---
id: brand-token-architecture-alias-migration
kind: story
stage: implementing
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
