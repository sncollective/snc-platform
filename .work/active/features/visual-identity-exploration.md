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

## Campaign results (2026-08-15)

Harness + skill built and dogfooded: 48/48 captures, 3 vision reviewers, adjudicated into
`public-screen-audit-fixes` (1 artifact rejected + recorded as discipline). Harness gap
found and fixed mid-campaign (auth-redirect detection — governance-calendar was capturing
the login page).

## Synthesis — direction themes for the brainstorm (operator's call which to pursue)

1. **Identity is unevenly distributed.** Home/feed/studio/press read S/NC (Fraunces
   register, voice grammar, editorial structure). Pricing, merch, and the auth pages read
   as generic SaaS/template surfaces wearing the shell. Direction: extend the editorial
   register SELECTIVELY (display moments, cooperative-specific framing/structure) to
   commerce + first-touch surfaces — typographic/structural identity, NOT the removed
   signature-chip grammar.
2. **Empty/degraded states are the weakest class everywhere.** Merch coming-soon, home
   Coming-Up, live off-air, creator no-avatar, "0 posts". Direction: a designed empty-state
   SYSTEM (one pattern language: mark, copy, expectation, one action) applied across
   surfaces — high leverage, touches every surface's worst moment.
3. **/live is the least-resolved public surface.** State contradictions + arbitrary slate +
   mobile overflow. It needs its own design pass (off-air state as a designed moment, not a
   failure to be live) — candidate for ux-ui-design screens exploration.
4. **The mark can carry further.** Nav just got the brush-script mark; favicon is still a
   generic "S" tile; og/social cards, PDF letterhead, and email are unmarked. Direction:
   identity-asset extension pass (cheap, high visibility).
5. **Auth as first touch.** Login/register are the front door and currently the most
   generic surfaces. Direction: welcoming + cooperative framing ("what you're joining")
   within the no-chip ruling.

Research posture: findings are execution-level, not "unknown what good looks like" — defer
external research until a direction is picked, then targeted (e.g. media-coop brand
patterns, empty-state pattern libraries) if wanted.
