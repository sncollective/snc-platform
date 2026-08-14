---
id: brand-token-architecture-route-scoping-contract
kind: story
stage: done
tags: [design-system]
parent: brand-token-architecture
depends_on: [brand-token-architecture-voice-accents]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Token foundation — route-scoping CSS contract

## Brief

Add the `[data-route]` alias-resolution blocks (per `brand-token-architecture` →
`## Design — Theming & route mechanism` → "Route voice resolution"):
`[data-route="studio|tv|records"]` blocks re-point every generic color/radius/font/link alias
at the matching family. Also set `[data-route] { font-family: var(--font-body); }`: changing
`--font-body` on a subtree does not recompute the `font-family` already resolved on `<body>`;
headings already resolve `--font-display` per element. **CSS contract + tests only** — sibling
feature `brand-voice-route-scoping` (epic child 2) consumes this boundary and wires real leaf
containers.

## Acceptance

- Route blocks for studio / tv / records resolve every generic color, radius, font, and link
  alias from literal-free `voices/resolution.css`; Parent is the no-attribute default.
- Fixtures assert computed accent/radius values for each route and computed `font-family` on
  ordinary body-copy descendants inside each scoped subtree (not only the custom-property
  value). Heading fixtures assert per-element `--font-display` resolution.
- The `[data-route] { font-family: var(--font-body); }` rule is documented as a child-2
  route-container boundary requirement.
- No runtime plumbing or `data-effective-voice` implementation (that's epic child 2 / the
  deferred future seam).

## Implementation notes

- Added complete, literal-free Studio, TV, and Records route blocks in
  `voices/resolution.css`. Each block re-points the color/link, radius-scale, body-font, and
  display-font aliases to its family sources. Parent remains the no-attribute `:root`
  fallback; no Parent route block or `data-effective-voice` seam was added.
- Kept `[data-route] { font-family: var(--font-body); }` as the child-2 route-container
  boundary and documented why it is required: `<body>` resolves its font outside the leaf
  scope, so ordinary descendants need the leaf container to recompute `font-family`.
- Fixture mechanism: used the established structural CSS-contract pattern in
  `apps/web/tests/unit/styles/`. jsdom 26 does not resolve custom properties in
  `getComputedStyle()` (it preserves `var(--token)` for colors and returns an empty computed
  `font-family`), so browser-computed assertions would be dishonest. The structural fixtures
  instead parse every route block, assert the exact complete alias map, follow accent/radius
  and body/display font chains to concrete declared source values, assert the scoped
  `font-family` rule, and reject Parent/override attribute blocks. A real browser-computed
  fixture belongs with child 2 when runtime leaf containers are wired.
- Verification: `bun run --filter @snc/web test` (190 files, 1,963 tests) and
  `bun run --filter @snc/web build` both pass. The test run retains existing jsdom navigation
  diagnostics, and the build retains existing third-party `use client` warnings; neither is
  a failure.
