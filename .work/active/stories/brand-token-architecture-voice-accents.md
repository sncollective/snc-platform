---
id: brand-token-architecture-voice-accents
kind: story
stage: implementing
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
