---
id: visual-identity-exploration
kind: feature
stage: implementing
tags: [design-system, ui]
parent: null
depends_on: []
release_binding: null
gate_origin: operator direction 2026-08-15 (branding/visual-identity exploration arc)
created: 2026-08-15
updated: 2026-08-15
---

# Visual identity exploration — audit the public surface, build the agent tooling, brainstorm directions

## Brief (operator, 2026-08-15)

Improve the site's branding/visual identity. Three asks: (1) exploration + brainstorming
(research where useful), (2) adversarial review of every public-facing screen, (3) gain the
tools agents need to help in this direction. First concrete item already landed: the
brush-script S/NC logo mark now replaces the text logo in the nav (`02b57d2`).

## Shape

1. **`public-screen-audit-harness`** — the tooling: a capture script (public routes ×
   light/dark × desktop/mobile, real Chromium) + a `screen-audit` skill so any agent can
   run captures and dispatch vision-capable adversarial reviewers without re-deriving the
   recipe. This generalizes the ad-hoc capture pattern used throughout the voice arc.
2. **`public-screen-adversarial-review`** — the campaign: every public screen through the
   harness, vision-reviewed adversarially (hierarchy, spacing, typography, color, chrome
   consistency, responsive, "would a designer ship this"), findings filed.
3. **Synthesis/brainstorm** — findings + research folded into direction options for the
   operator/org (feeding org's brand system or the ux-ui-design mockup pipeline). NOT
   decided here — this arc surfaces options.

## Public surface inventory (2026-08-15)

`/`, `/feed`, `/live`, `/studio`, `/creators`, `/creators/$creatorId`,
`/creators/$creatorId/press`, `/content/...`, `/emissions` (currently 500s — parked bug
`emissions-public-page-500`), `/merch`, `/pricing`, `/governance/calendar` (+ governance
children), `/projects/...`, `/login`, `/register`, `/forgot-password`, `/privacy`,
`/join/...`, `/invite/...`. Internal (`/manage/**`, `/admin`, dashboards) is out of scope
for this arc.
