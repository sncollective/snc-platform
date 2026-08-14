---
id: brand-token-architecture
kind: feature
stage: drafting
tags: [design-system]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-13
updated: 2026-08-13
---

# Brand token architecture: neutral spine + per-voice accents

## Brief

Adopt org's brand-architecture token model (endorsed branded house, realized as a
neutral product spine + breathing per-unit voices) into platform's token layer. Source
of truth for the *target* shape:

- `org/.mockups/design-system/brand-tokens-reference.css` — the reference token file
  (exact names + placeholder values, light + dark, route-scoping pattern).
- `org/.research/analysis/positions/brand-architecture.md` — the locked position
  (held-pending-stakeholder: structure/naming stable; values refine after sign-off).
- `.agents/skills/brand-architecture/SKILL.md` — the generic framework.

**Current state (audited this session):** 96 distinct color values platform-wide —
only 28 are official tokens; **68 are ad-hoc leaks** outside the token layer. Dark-only
(`global.css` hardcodes `color-scheme: dark`; no `data-theme`, no toggle, no
`prefers-color-scheme`). No `data-route` plumbing. Type is Inter + Georgia; the
reference's per-voice families aren't loaded. The reframe: we are not "condensing 96 →
42"; we are **classifying 96 raw values onto ~42 disciplined semantic roles** (×2 modes).
The spec *expands* our semantic surface while *disciplining* the raw layer.

**This feature's immediate deliverable is the design/mapping brief** — it resolves the
open mapping decisions, writes the spine-vs-voice convention, and produces the
authoritative token-role → platform mapping table. Execution (token restructure, light
mode, route-scoping, leak cleanup, font-loading, alias migration) is **deferred**: it
spawns as child stories (or escalates to an epic) only after the brief is approved. The
brief is the structured version of the operator scoping conversation; do not begin code
changes until it lands.

Values are seeded from the reference as **placeholders** (org-confirmed) so the
structure is visible/testable now; swapped in one pass when stakeholders sign off.

## Simplification opportunity

- Collapse the 68 ad-hoc leaks into disciplined tokens (the ~16 near-identical dark-navy
  shades → ~3 neutral-ramp steps; ~7 success greens → one `--color-success`; ~8 error
  reds → one `--color-error`).
- Retire `--color-secondary` (teal) — it carries three unrelated meanings; each consumer
  migrates to its real semantic home.
- Migrate consumers off the backwards-compat alias tokens (`--color-primary`,
  `--color-muted`, `--color-text-on-accent`, `--color-bg-alt`, etc.) — the reference's
  naming is the target; aliases are not kept.
- Defining `--color-info` (spec `#1565C0`) silently fixes two latent fallbacks
  (`team-section.module.css`, `playout.module.css`) currently diverging to different blues.

## Strategic decisions (locked — operator-confirmed 2026-08-13)

- **Spine accent = Parent steel, amber retires.** Platform is early-alpha with no users;
  visual continuity is not a constraint (`#f5a623` amber is referenced across ~104 files
  but is not a voice color — it retires rather than mapping to any unit). Adopt the spec's
  neutral-steel spine cleanly.
- **Content badges adopt the spec's desaturated palette** (audio/video/written) — fixes
  the current conflation where the video badge shares the accent hue.
- **Voice → route mapping:** press + library → **Records**; `/studio` → **Studio**;
  live-broadcast surfaces → **TV**; everything else → **Parent** (the default spine).
- **Vendor brand colors are exempt** from the token system (third-party icons/links keep
  their brand colors). Note: the lone `#1a73e8` in `team-section` is a *missing-`--color-info`
  fallback*, not a vendor color — it resolves to the info token once defined.
- **Values seeded as placeholders**, swapped on stakeholder sign-off (org-confirmed).

## Categorization artifact

Full color-use categorization (96 values, 149 occurrences, 64 token names, ~3,450 `var()`
refs) with per-use intent + target role + bin triage:
`.memory/scratchpad/color-categorization.md`. Headline finding: guaranteed-contrast
foregrounds (on-media/on-status/on-badge) are the biggest unmodeled light-mode risk — not
the navy-shade proliferation (which collapses cleanly to ~3 ramp steps).

## Resolved design decisions (operator, 2026-08-13)

- **Interaction-state policy = spine-stable.** Selection/focus/hover/disabled are shared
  functional affordances (per the skill's functional-colors rule), not identity — they stay
  on spine tokens; voice accent is reserved for CTAs/emphasis. This is also platform's
  recommendation to org for the P0 interaction-state gap.
- **TV voice = `/live` only.** Consumer-facing broadcast surface. Playout + simulcast are
  admin tooling → Parent. (Principle: voices apply to public-facing surfaces.)
- **Radius = derived variants.** Define `--radius-sm/md/lg` derived from each voice's base
  `--radius` (preserves the 257-ref proportional scale while still breathing per voice);
  `--radius-circle` / `--radius-pill` stay invariant.
- **Records scoping = leaf-only.** `data-route` set on press/library content leaves; the
  persistent `/manage` shell (sidebar/header) stays Parent. Principle: voices apply to
  public-facing content surfaces; internal tooling shells stay Parent.
  **Nuance to confirm:** the warm Records-ish palette currently lives on the *internal
  authoring* screens (`/manage/press`, `/manage/library`); the *public* press kit is
  `/creators/$creatorId/press/`. Confirm Records targets the intended surface.

## Reference gaps → org adjudication (5; message drafted, pending operator send-approval)

Five categories the reference has no home for; clustered as the missing **affordance**
(states, links) + **data** (categorical) + **guaranteed-contrast** (on-media/on-status/
on-badge) layers — all acute in light mode:
1. Interaction-state roles (P0) — see resolved decision above for platform's lean.
2. Categorical/data-viz series (P0) — `--color-data-1…N` + chart-grid/tooltip roles.
3. Guaranteed-contrast foregrounds (P0, biggest light-mode risk) — `--color-on-media` /
   `-on-media-muted` + `--color-on-status`/`-on-badge` (or badge redesign to ink-over-`*-bg`).
4. Link roles (P1) — first-class shared interaction role, or alias to route accent?
5. accent-subtle wiring (P2, reference oversight) — Parent omitted; generic not exposed.

## Open questions the brief must still resolve

- **Teal decorative per-use mapping** — booking / landing-pricing / subscription /
  studio-inquiry / press-decoration consumers → assign each to route accent / success /
  info / neutral (no generic secondary).
- **Status-semantics labels** — completed / subscribed / open-granted / inactive → assign
  to success/success-bg, info/info-bg, or neutral.
- **Creator-brand color coexistence** — confirm orthogonal data (not a fifth voice);
  pending the org principle on creator-authored colors.
- **Hero-gradient token** — derive from bg/bg-elevated/surface, or retain a documented
  mode-aware hero-surface role.
- **Warning/info promotion** — warning → first-class with spec value; add `--color-info`
  (#1565C0), resolving latent fallbacks in team-section + playout. (Mostly mechanical.)
- **Records target surface** — see nuance in Resolved decisions (internal authoring vs
  public press kit).

## Brief deliverables (what "done" looks like for this feature's design phase)

1. **Mapping table** — every one of the 96 current values → target role (neutral ramp /
   status / badge / voice accent / exempt), with the collapses and retires called out.
2. **Spine-vs-voice conventions** — written into `platform-patterns.md` (+ the AGENTS.md
   CSS section): mode-awareness rule; generic components consume `--color-accent` /
   `--color-on-accent` / `--radius` / `--font-body` / `--font-display` (route-resolved),
   never raw `--voice-*`; direct `--voice-*` use sanctioned only for signature chips
   (MEMBER-OWNED / 24·96 / ●LIVE / A1).
3. **Theming & route mechanism design** — `data-theme` light/dark + system-pref + toggle;
   `data-route` plumbing pattern. Spec'd in the brief even though execution is deferred.
4. **Font-loading plan** — Source Sans 3 / Newsreader / Saira / Archivo / Barlow Condensed /
   Fragment Mono (self-host vs Google Fonts decision).
5. **Execution breakdown** — proposed child stories (token restructure → theming → voice
   accents → route-scoping → leak cleanup → font-loading → alias migration) with
   dependency order, scoped *after* the brief is approved.

<!-- Design accumulates here as feature-design runs. Execution spawns as children once
     the brief above is approved by the operator. -->
