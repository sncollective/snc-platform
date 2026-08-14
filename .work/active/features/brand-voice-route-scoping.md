---
id: brand-voice-route-scoping
kind: feature
stage: drafting
tags: [design-system]
parent: brand-voice-system
depends_on: [brand-token-architecture]
release_binding: null
gate_origin: null
created: 2026-08-13
updated: 2026-08-13
---

# Brand voice — route-default scoping

## Brief

Implement the route-scoping mechanism so each route resolves to its default voice. Generic
components consume the route-resolved tokens (`--color-accent`, `--color-on-accent`,
`--color-accent-hover`, `--color-accent-bg`, `--color-accent-subtle`, `--radius`,
`--font-body`, `--font-display`); direct `--voice-*` use is sanctioned only for signature
chips (MEMBER-OWNED / 24·96 / ●LIVE / A1). This is the "auto" behavior that the user-toggle
(child 3) defaults to.

## Scope

- `data-route` (or equivalent) attribute plumbing on route containers (TanStack file routes;
  per-leaf-route — the `/manage` shell is Parent, only its public-facing leaves breathe).
- Voice → route map (locked, see epic): `/studio` → Studio; `/live` → TV; public press kit
  (`/creators/$creatorId/press/`) → Records; everything else → Parent.
- Route-scoping CSS blocks per the reference pattern
  (`[data-route="studio"] { --color-accent: var(--voice-studio-accent); ... }`).
- Records nuance: the warm palette currently on the *internal* `/manage/press` +
  `/manage/library` screens is misplaced (those are Parent); it migrates to neutrals in
  child 1. Records applies only to the public press kit.

## Simplification opportunity

- Once route-scoping resolves `--color-accent` everywhere, no component should hardcode a
  voice accent directly — retire the implicit voice-less accent usage.

## Depends on

`brand-token-architecture` — voice accent tokens + the route-resolved generic tokens must
exist first.

<!-- Design accumulates via feature-design / refactor-design once the foundation lands. -->
