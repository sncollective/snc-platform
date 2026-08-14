---
id: brand-voice-system
kind: epic
stage: drafting
tags: [design-system]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-13
updated: 2026-08-13
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

## Status

**Lineage:** realizes the planned `design-system-phase-6-theme-system` (per
`ui-ux-system-plan.md`), previously gated on designer onboarding — now unblocked by org's
brand-architecture work. The backlog stub is superseded by this epic.

Child 1 (`brand-token-architecture`) is in active design — categorization complete, gap
adjudications resolved, token-layer decisions locked; the mapping table + conventions +
mechanism design are the remaining brief deliverables. Children 2–4 are stubbed at drafting,
awaiting their design passes once the foundation firms up.
