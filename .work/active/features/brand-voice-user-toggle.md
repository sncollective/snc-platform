---
id: brand-voice-user-toggle
kind: feature
stage: drafting
tags: [design-system]
parent: brand-voice-system
depends_on: [brand-token-architecture, brand-voice-route-scoping]
release_binding: null
gate_origin: null
created: 2026-08-13
updated: 2026-08-13
---

# Brand voice — user-selectable toggle + appearance settings

## Brief

Add an appearance pane to settings with two orthogonal user-controllable dimensions:
- **Mode:** light / dark / system (respect `prefers-color-scheme` + persistent toggle).
- **Voice:** auto / parent / studio / tv / records — **global + auto default**
  (operator-confirmed): one voice platform-wide; "auto" = route-respecting (child 2's map).

Precedence: user-explicit voice > route-default. The route-scoping mechanism (child 2)
remains the "auto" behavior; the toggle layers a user override on top.

## Scope

- `data-theme` (light/dark) mechanism + system-preference detection + persistence.
- `data-voice` (or equivalent) user-override mechanism, global scope, "auto" default.
- Settings appearance UI (likely under `/settings`); co-locate mode + voice controls.
- Preference persistence (user store).

## Simplification opportunity

- Co-locate the mode toggle with the voice toggle — a single appearance surface. Today there
  is no theme toggle at all (`global.css` hardcodes `color-scheme: dark`).

## Depends on

`brand-token-architecture` (tokens + modes) + `brand-voice-route-scoping` (the "auto"
behavior the toggle defaults to).

<!-- Design accumulates via feature-design once children 1+2 land. -->
