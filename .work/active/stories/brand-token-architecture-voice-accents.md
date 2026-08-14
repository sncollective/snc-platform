---
id: brand-token-architecture-voice-accents
kind: story
stage: done
tags: [design-system]
parent: brand-token-architecture
depends_on: [brand-token-architecture-theming]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Token foundation — voice accent families

## Brief

Define the complete four-voice color families (Parent / Studio / TV / Records) — accent,
hover, bg, subtle, on-accent, accent2 — in both modes in their sole owner,
`voices/families.css`. Declare each voice's base + sm/md/lg/xl radius values only in
`radius.css`. Set every Parent generic color/radius/font/link default in literal-free
`voices/resolution.css` until route blocks land in `route-scoping-contract`.

## Acceptance

- All four voice color families are complete in both modes (six color roles, including
  `accent-subtle`); `families.css` contains no radius or generic aliases.
- All four base + sm/md/lg/xl radius families exist only in `radius.css`; invariant
  circle/pill values remain in `geometry.css`.
- Parent is the `:root` default for every generic color/radius/font alias, all declared only
  in literal-free `voices/resolution.css`.
- Provisional link aliases are centralized in `voices/resolution.css`; prose/inline links
  are underlined by default, with structural nav/chrome exceptions.

## Implementation notes

- Completed all four six-role voice color families in light, explicit dark, and exact
  no-attribute dark fallback blocks. The reference leaves dark Parent `accent-bg` and all
  dark `accent2` roles inherited from light; they are repeated with those published values
  so each mode block remains complete without inventing new brand values.
- Added explicit proportional radius scales (half/base/one-and-a-half/double) for Parent,
  Studio, and TV; Records remains square at every ordinary size. Circle and pill geometry
  remain owned by `geometry.css`.
- Added the literal-free Parent resolution contract for all color, link, radius, and font
  aliases. Per-family typography sources temporarily preserve the current Inter/Georgia
  behavior until the dedicated font-loading checkpoint. Superseded accent/link and generic
  radius declarations were removed from the transitional files so aliases have one owner.
  The generic `[data-route]` font-family recomputation rule landed without route-specific
  blocks.
- Global prose links now use the link aliases and underline by default. Semantic navigation
  containers (`nav`, navigation roles, and tablists) opt out globally; existing chrome and
  component selectors continue to provide their own structural treatment.
- Extended structural and contrast coverage for mode parity, complete voice matrices,
  ownership boundaries, radius ordering/proportions, Parent variable-chain integrity,
  link treatment, and AA-safe base/hover accent pairs in both modes.
- Verification: `bun run --filter @snc/web test` (189 files, 1,952 tests passed) and
  `bun run --filter @snc/web build` (passed; existing dependency `use client` warnings only).
