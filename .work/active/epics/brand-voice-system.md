---
id: brand-voice-system
kind: epic
stage: done
tags: [design-system]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-13
updated: 2026-08-14
---

# Brand voice system: neutral spine + breathing voices + themable identity

## Brief

Adopt org's brand-architecture model as a full, themable voice system across the platform
web app. The model (endorsed branded house): a **neutral product spine** (shared neutrals +
status + badges, mode-aware) + **breathing per-unit voices** (Parent / Studio / TV / Records
accent families), with **light + dark modes**, **route-default voice scoping**, an optional
**user-selectable voice override**, and **voice-themed export** (press PDFs).

Source of truth:
- `org/.mockups/design-system/brand-tokens-reference.css` — reference token model (names +
  placeholder values, light + dark, route-scoping pattern).
- `org/.research/analysis/positions/brand-architecture.md` — locked position
  (held-pending-stakeholder: structure stable, values refine after sign-off).
- `.agents/skills/brand-architecture/SKILL.md` — generic framework.

Why an epic: the work spans the token layer, a route-scoping mechanism, and export
theming — three cohesive MVP features with a strict dependency order. (A user-selectable
voice toggle was considered and **deferred** per org — see Product/UX adjudications.)

## Decomposition

| Child | Scope | Depends on | Size |
|---|---|---|---|
| `brand-token-architecture` | restructure tokens to reference model + light/dark (incl. mode toggle) + leak cleanup + font-loading + alias migration | — | large |
| `brand-voice-route-scoping` | `data-route` plumbing + voice accent tokens; route→voice defaults (Parent = default when no scope) | brand-token-architecture | medium |
| `brand-voice-export-theming` | wire voice tokens into existing Playwright PDF render + print CSS; export voice = producing unit's voice | brand-token-architecture | small |
| ~~`brand-voice-user-toggle`~~ | **DEFERRED** (off-table for MVP per org) → parked in backlog | — | — |

Sequencing: 1 → 2; 4 parallels after 1. (3 deferred.) The light/dark **mode toggle** lives
in child 1 (it is polarity, not voice-selection).

## Cross-cutting locked decisions

- **STATE vs IDENTITY (org adjudication):** if it's a STATE (focus/selected/hover-bg/
  disabled) → SHARED (spine); if it's IDENTITY (buttons/links/nav-active) → BREATHES with
  the voice.
- **Public-facing principle:** voices apply to public-facing content surfaces; internal
  tooling shells (e.g. the `/manage` dashboard) stay Parent.
- **Voice → route map:** `/studio` → Studio; `/live` → TV; public press kit
  (`/creators/$creatorId/press/`) → Records; everything else → Parent (the default spine).
- **User-voice-override = OFF THE TABLE for MVP** (org/principal 2026-08-13: voices are
  identity-bearing — they tell you which unit you're in — so user-swappable breaks the
  semantic). Route-scoping (child 2) is the **sole** MVP voice mechanism. Parent-fallback
  is architecturally supported (route-scoping defaults to Parent when no `[data-route]` is
  active). A future user-facing "neutral/Parent mode" toggle is documented but **not built**
  — revisit after the architecture is established (parked: `brand-voice-user-toggle`).
- **Spine accent = Parent steel;** current amber (`#f5a623`) retires (alpha — no continuity
  constraint).
- **Values seeded as placeholders,** swapped in one pass on stakeholder sign-off
  (org-confirmed).
- **Interaction-state policy = spine-stable** (derived from the STATE/IDENTITY rule).

## Reference gaps → org adjudicated (2026-08-13, all resolved)

1. Interaction states → spine-stable; org extends reference (focus/selected-bg/hover-bg/
   disabled/disabled-bg). [token-layer; child 1]
2. Categorical/data-viz → audience-split: internal charts platform-local; public charts
   (emissions, revenue) brand-constrained (org provides). [child 1 defines internal palette]
3. Contrast foregrounds → split: org adds on-media/on-media-muted; platform resolves
   on-status/on-badge (WCAG AA). [child 1]
4. Links → alias to route accent (identity breathes) — PROVISIONAL (validate in situ).
   [child 1/2]
5. accent-subtle → org fixing (Parent omitted); adopt when published. [child 1]

Full detail (evidence, proposals) in `brand-token-architecture` (child 1).

## Product/UX decisions → org adjudicated (2026-08-13)

1. **User-selectable voice override → OFF THE TABLE for MVP** (deferred). Voices are
   identity-bearing; user-swappable breaks the semantic. Parent-fallback is architecturally
   supported (route-scoping default); a future "neutral mode" toggle is documented, not
   built. → child 3 parked in backlog.
2. **Export voice = the producing unit's voice** (confirmed). Records press kit → Records;
   Studio services doc → Studio; unknown unit → default Records. Creator brand color
   persists as override ONLY for federation-entry creators with established brand identity;
   creator-chosen = off. Public-facing → brand-constrained. → child 4 spec.
3. **WCAG → confirmed** for any-voice-anywhere: all per-voice accent+on-accent pairs pass AA
   in both modes (neutrals shared; accent+on-accent voice-internal). No new verification;
   no token-reference change.

## Reference updates (2026-08-14, post-review)

Org fixed the review-flagged value issues in place (reference re-published):
- Dark Parent hover override added (`#8E9AAC` — was the light-hover inheritance bug, ~1.28:1
  → 6.25:1).
- Light success `#2A722E` (4.90:1), error `#B71C1C` (5.23:1); dark error `#FF7A70`, info
  `#6FB3F0`.
- **Dark status `-bg` values now OPAQUE** — host-independent, permitted on bg or elevated
  (5.9–7.4:1). Platform's ask (a) delivered.
- Verification-matrix contract: hover/disabled/tint composites are part of the reference
  contract — mirrored in platform's contrast harness.
- Links underline-by-default approved by org (part of in-situ link validation).

Structure/naming untouched; values remain placeholders pending stakeholder sign-off.

## Autopilot handoff (2026-08-14)

State at handoff time (2026-08-14): drain-ready. **[Historical — superseded: the drain completed the same day; see `## Child features reviewed and complete`.]** `brand-token-architecture` (child 1) at implementing — `token-restructure`
READY, 6 stories chained; `brand-voice-route-scoping` (child 2) fully designed at drafting;
`brand-voice-export-theming` (child 4) undesigned. Run the drain on this epic.

**Operator directive:** autopilot (fresh context) may design anything without obvious open
operator questions. Child 4's design questions are already adjudicated (export voice =
producing unit's voice; creator-brand override only for federation-entry creators; unknown
unit → Records; public-facing → brand-constrained) — design it during the drain without
pausing for input. Anything surfacing a genuine new product/UX decision: park it and
surface at the end rather than blocking.

External gates (do NOT block early stories): org's public-chart palette gates only the
`--legacy-public-chart-*` bridge deletion in `alias-migration` (bridge carries current
chart colors meanwhile, with owner + expiry); stakeholder-final token values land as a
late one-pass swap. The re-published reference (`org/.mockups/design-system/brand-
tokens-reference.css`) is the current value source. Contrast harness mirrors org's matrix:
fg/bg + fg/elevated, both modes, base + hover + disabled + tint composites.

## Status

**Lineage:** realizes the planned `design-system-phase-6-theme-system` (per
`ui-ux-system-plan.md`), previously gated on designer onboarding — now unblocked by org's
brand-architecture work. The backlog stub is superseded by this epic.

As of 2026-08-14, final state: all three child features are done and reviewed — token
architecture (including all 7 stories), route scoping, and export theming. The user-selectable
voice toggle remains deferred per org and parked as `brand-voice-user-toggle`. The residual
`accent-bg-consumer-recipe-alignment` remains parked, and values remain placeholders pending
the stakeholder swap.

## Child features reviewed and complete (2026-08-14)

- `brand-token-architecture` — done (review closed 9bdc9d3; fixes a4bb370 + org accent-bg re-seed; residual parked: `accent-bg-consumer-recipe-alignment`).
- `brand-voice-route-scoping` — done (review closed e45e59d; clean ready verdict, no findings).
- `brand-voice-export-theming` — done (review closed 391580d; 3 findings fixed in b41da14).

Integrated verification across the epic: web 2,019 tests + API 2,037 unit + 55 integration green on final state; builds/typechecks green; no-leak checker zero non-exempt violations across CSS + CSS-in-TSX faces; org reference value fixes (dark hover, opaque status bgs, dark Parent accent-bg, public-chart palette) all adopted.

## Epic review — standard aggregate pass (2026-08-14)

**Verdict: needs fixes → fixed → done.** Cross-model fresh-context (host GLM-5.2 → GPT-5.6 Sol).
The aggregate runtime contract passed clean: route-scoped voices, portal propagation,
light/dark appearance, Parent fallback, and explicit Records-themed exports align across
packages; all suites green (web 2,019 / api 2,037 unit / 55 integration); token names,
cascade precedence, creator-decoration eligibility, font strategy, Chromium concurrency,
and PDF rate limits agree across feature seams. Six risky proposals rejected with evidence
(shell theming, route-derived PDF voice, accent-bg residual as blocker, voice picker,
eager font loading, unbounded PDF generation).

Three important findings — all documentation/substrate consistency — adjudicated valid and
fixed in `05c27c7`: epic Status section rolled to final state (+ backlog stub), active
UI/UX reference rolled forward (Phase 6 realized), mockup token mirror re-synced from
production. `review -> done`.
