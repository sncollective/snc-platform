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

## Open questions the brief must resolve

- **Teal retirement mapping.** `--color-secondary` does three jobs: (a) selection/active
  indicator (media-picker, content-lists), (b) calendar event category color, (c)
  secondary decorative accent (landing/booking/plan-card). Each needs a target. Sub-question:
  does selection use the active voice's `--color-accent` (breathes per-route) or a spine
  `--color-selected`? And **calendar category colors are a spec gap** — there is no
  categorical/data-viz concept in the reference; raise to org.
- **Route-scoping granularity.** `/creators/$creatorId/manage` is a Parent *shell* holding
  ~12 subsections; only `press` + `library` leaves are Records. Confirm `data-route` is set
  per-leaf-route (TanStack file routes make this clean). Decide: does the persistent manage
  shell (sidebar/header) stay Parent while only the content area breathes?
- **TV voice target routes.** No `/tv` route exists. Live-broadcast candidates are `/live`,
  admin/playout, simulcast — confirm which get the TV voice.
- **Warning re-color + info addition.** Warning promotes from alias to first-class with the
  spec's value; `--color-info` is new (spec `#1565C0`), resolving two latent fallbacks.
  Confirm no other ad-hoc info/warning usage escapes the audit.
- **Per-creator brand color coexistence.** `creator-profile-brand-color` (done) gives
  creators a brand-color data field. Confirm it is orthogonal to (not in conflict with) the
  route-scoped voice system.

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
