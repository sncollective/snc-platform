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
- **Records voice = public press kit.** Records targets the public press route
  `/creators/$creatorId/press/` (operator-confirmed 2026-08-13: voices are for public-facing
  surfaces). Consequence: the warm Records-ish palette currently on the *internal authoring*
  screens (`/manage/press`, `/manage/library`) is **misplaced** — those are internal tooling
  and stay Parent (spine); their warm hexes migrate to neutrals, not Records. Open follow-on:
  is there a public library surface, or does `/manage/library` stay Parent? (Default Parent
  until one exists.)

## Reference gaps → RESOLVED (org adjudication 2026-08-13)

Org adjudicated all five; structural calls, not value-dependent — **migration unblocked**.
**Key discriminator (org):** if it's a STATE (focus/selected/hover-bg/disabled) it's SHARED;
if it's IDENTITY (buttons/links/nav-active) it BREATHES with the voice.

1. **Interaction states → SPINE-STABLE; org extends the reference.** Adopt org's new shared
   tokens (both modes, placeholder values): `--color-focus`, `--color-selected-bg`,
   `--color-hover-bg`, `--color-disabled`, `--color-disabled-bg`. Tune for WCAG 2.2 Focus
   Appearance. (Matches platform's lean.)
2. **Categorical/data-viz → AUDIENCE-SPLIT (refined by org/principal 2026-08-13).**
   - **Internal/admin charts** (calendar, analytics, governance tools) → **platform-local**:
     platform owns `--color-data-1…N`, tagged internal-use; colorblind-safe, harmonized with
     spine temp/saturation, distinct from voice accents + status.
   - **Public-facing charts** (emissions dashboard, revenue transparency, any member/patron
     data-viz) → **brand-constrained**: org provides constraints or a concrete palette when
     the surface gets themed. Rule: if public, check with org before picking chart colors.
   Concrete mapping: `emissions-chart` + `revenue-chart` = public (wait on org); calendar
   event colors = internal (ours).
3. **Guaranteed-contrast foregrounds → SPLIT.** Org extends the reference with
   `--color-on-media` / `--color-on-media-muted` (shared, both modes; pattern = white +
   `--color-overlay` scrim). Platform resolves status-fill + badge contrast — define
   `--color-on-status`/`-on-badge` OR constrain usage to `-bg` tints; constraint is WCAG AA.
4. **Links → ALIAS to route accent (identity, breathes) — PROVISIONAL.**
   `--color-link: var(--color-accent)`, `--color-link-hover: var(--color-accent-hover)`. Not a
   separate shared role. Principal wants to see it in action and may revisit → implement as
   alias (cheap revert to a shared token if reversed); flag for in-situ validation.
5. **accent-subtle → reference oversight, org fixing.** Org adds `--voice-parent-accent-subtle`
   (both modes) + exposes `--color-accent-subtle` in route-scoping. Adopt when published.

Five internal categories (overlay/creator-brand/gradients/editing-guides/elevation) — org
confirms platform owns them. Org is publishing the reference extension (items 1, 3, 5) now;
adopt their exact token names verbatim when it lands.

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
## Scope expansion under discussion: voice as user-selectable theme

Operator raised (2026-08-13): voices could be (a) themes for press/pdf outputs, and/or
(b) a user-selectable platform-wide setting (pick a voice, or "auto/accept" = route
default) co-located with the light/dark/system toggle in settings.

Reframe: voices become a themable identity layer with three application modes — route-default
(auto), user-override (explicit pick), and export/output theme. Right instinct (makes voices
a real product feature, not a rigid route-skin) and does NOT invalidate route-scoping — the
route mapping becomes the "auto" behavior.

Analysis:
- Two orthogonal user-controllable dimensions in settings: mode (light/dark/system) + voice
  (auto/parent/studio/tv/records). Same appearance pane.
- Precedence: user-explicit voice > route-default (route sets default on its container; user
  override wins at higher scope).
- Sequencing: user-toggle DEPENDS on voice tokens + route-scoping existing → later phase.
- Export/print theming is a distinct medium (no dark mode, fixed palette, page mechanics),
  likely a separate feature — confirm whether press/pdf export exists today.

Proposed decomposition (likely promotes this to an epic with child features):
1. Token foundation + light mode + leaks + fonts + aliases (current feature scope).
2. Route-default voices (route-scoping mechanism — the "auto" behavior).
3. User-selectable voice toggle + settings appearance pane (depends on 1+2).
4. Export/print voice theming (separate; depends on 1).

Open questions for the operator:
- User-override scope: GLOBAL (one voice everywhere, "auto" = route-respecting default) or
  per-route? Lean: global + auto default (matches the light/dark toggle metaphor).
- Confirm export/print theming is net-new (no existing press/pdf export)?

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
