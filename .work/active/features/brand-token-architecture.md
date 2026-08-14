---
id: brand-token-architecture
kind: feature
stage: drafting
tags: [design-system]
parent: brand-voice-system
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
## Epic: brand-voice-system

This feature is **child 1 (token foundation)** of the `brand-voice-system` epic. The
voice-as-user-selectable-theme + export-theming expansion discussed earlier is decomposed
into sibling children under that epic:
- `brand-voice-route-scoping` (child 2) — route-default voice mechanism.
- `brand-voice-user-toggle` (child 3) — settings appearance pane (mode + voice, global +
  auto default).
- `brand-voice-export-theming` (child 4) — wire voice tokens into the existing Playwright
  PDF render.

Cross-cutting locked decisions (STATE/IDENTITY rule, public-facing principle, global+auto
toggle, voice→route map, org gap adjudications) live in the epic.

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

6. **Scoped refactor-discovery** (folded in while the CSS surface is open) — scan the
   ~30 migrated CSS modules for structural simplifications that ride along: split
   oversized modules (`manage-press.module.css` = 114 var-refs), unify the consumption
   inconsistency (`color-mix` vs `rgba` vs `var`), extract repeated styles, drop dead
   rules. Also flag component-extraction candidates (feature modules whose styling should
   become a `components/ui/` component) — these seed the parked
   `design-system-component-coverage-expansion`.

## Design — Mapping table

This section is the authoritative migration map. The per-occurrence audit remains in
`.memory/scratchpad/color-categorization.md`; it records every source line, count, and
intent inference. The tables below consolidate that evidence into implementation roles.
A literal appears in more than one row only when identical raw values currently carry
more than one meaning. The source inventory is reproducible at 96 distinct literals;
the current token layer starts at `apps/web/src/styles/tokens/color.css:5-17` and the
ad-hoc uses are enumerated in the scratchpad. Unless a citation is project-rooted, its
path is relative to `apps/web/src/`, matching the categorization artifact.

### Raw literal → target role

| current literal(s) | target role | migration ruling |
|---|---|---|
| `#000`, `#0c0c14`, `#171723` | `--color-media-bg` | Mode-invariant media wells. The two near-black picker values collapse into the existing media role (`media-picker.module.css:248,591,706`). |
| `#1a1a2e`, `#171725`, `#20203a` | `--color-bg` | Dark page/preview bases collapse to one spine step. The two `#1a1a2e` creator-brand foreground uses are the exception described below. |
| `#252542`, `#2a2a46`, `#2b2741`, `#343451` | `--color-bg-elevated` / `--color-surface` | Collapse by role: containers/dropdowns → elevated; subordinate cards → surface. The decorative `#252542` occurrence at `manage-press.module.css:825` is illustration, not a surface. |
| `#2a2a4a` | `--color-bg-input` | Current input primitive keeps its role. |
| `#f6f0e7`, `#f2ede4` | light `--color-bg` / `--color-bg-elevated` | Preview paper becomes the light spine rather than press-only tokens (`manage-press.module.css:494,569,586,673`). |
| `rgb(255 255 255 / 3%)` | `--color-surface` | Replace the literal preview-card veil at `manage-press.module.css:1033` with the mode-aware surface role. |
| `#1e1e36` | retire `--color-bg-hero-gradient` | Derive each hero gradient from `--color-bg`, `--color-bg-elevated`, and `--color-surface`; do not preserve a fourth navy step. Current consumers are identified in the scratchpad. |
| `#f0f0f0`, `#ddd8ce`, `#d1d1d9` | `--color-text` | Collapse body/preview ink to the mode-aware primary text role. |
| `#a0a0b0`, `#666`, `#888888`, `#c7c7d1`, `#6b7280` | `--color-text-muted` | Collapse muted copy, generic website icon, and inactive label ink. Inactive badges become neutral tint + muted ink, not a solid status fill. |
| `#3a3a5c`, `#505078`, `#6b6b89` | `--color-border` | Collapse dialog, placeholder, and spine outlines. |
| `#1a1a1a`, `#f5a623`, `#e09510`, `#ffd486`, `rgba(245, 166, 35, 0.1)` | route `--color-accent` / `--color-accent-hover` / `--color-accent-bg` | The generic CTA fallbacks remain identity roles, but all amber values retire. The active voice supplies the replacement. |
| `#ffd27a` | split: `--color-focus`, route accent, or `--color-warning` | Focus uses at `manage-press.module.css:31,452` become shared focus; lifecycle accent at `:220` becomes route accent; template limit at `:484` becomes warning. The literal retires. |
| `#231805`, `#251a08`, CTA uses of `#fff` | `--color-on-accent` | Replace dark-mode assumptions with the route-paired foreground. Current button shortcuts are visible at `library.module.css:33-61` and `global.css:134-144`. |
| `#8fd1d1`; selected/filter uses of `#9ed8d8`; `rgba(255, 255, 255, 0.05)` | `--color-selected-bg`, `--color-hover-bg`, plus normal `--color-text` | Selection is a shared state, not a teal identity. Selected controls use the state background and ordinary text; the two duplicate hover primitives collapse to `--color-hover-bg`. |
| focus uses of current accent | `--color-focus` | Global and component focus rules stop consuming identity. `global.css:79` and `button.module.css:24-25` show the current accent coupling. |
| `#4caf50`, `#16a34a`, `#8bd98f`, `#92dd96`, `#93e69a`, `#b6eeb8` | `--color-success` | Collapse all positive/ready/completed/granted inks. Completed, subscribed, and granted are success semantics. |
| `#ef5350`, `#c0392b`, `#dc2626`, `#ff8b88`, `#ff9c99`, `#ff9d9a`, `#ffaaa8`, `#ffb4b1`, `#ffd0ce` | `--color-error` | Collapse all danger, failure, archived, permission-required, and error fallback inks. |
| `#ffc45b`, `#ffd276`, warning use of `#ffd27a`, `#ffe0a4` | `--color-warning` | Dirty, blocked, limit, and visibility warnings become the first-class warning role. |
| `#1a73e8`, `#e8f0fe` | `--color-info`, `--color-info-bg` | Define the missing pair. The blue fallback at `team-section.module.css:114-115` and the separate playout consumer converge. `#1a73e8` is not vendor-exempt. |
| `rgba(239, 83, 80, 0.1)`, `rgba(76, 175, 80, 0.1)` | `--color-error-bg`, `--color-success-bg` | Existing tint definitions keep their semantic roles but take the reference's mode-specific placeholders. |
| project-completion use of `rgba(91, 181, 181, 0.2)` | `--color-success-bg` | Completed projects are success; the same literal's calendar use is categorical and maps separately. |
| `rgba(245, 166, 35, 0.85)`, `rgba(91, 181, 181, 0.85)`, `rgba(160, 160, 176, 0.6)` | `--color-badge-video`, `--color-badge-audio`, `--color-badge-written` | Replace current badge-fill aliases with the reference's category roles and desaturated placeholders. |
| `rgba(239, 83, 80, 0.2)`, calendar uses of `rgba(245, 166, 35, 0.2)`, `rgba(245, 166, 35, 0.3)`, `rgba(91, 181, 181, 0.2)`, `rgba(91, 181, 181, 0.25)`, `rgba(91, 181, 181, 0.3)`, `rgba(91, 181, 181, 0.4)` | internal `--color-data-1…6` + derived tints | Calendar categories are platform-local data roles. Domain aliases map event types to the series; no voice or status token doubles as a category. |
| open-sharing use of `#9ed8d8` | `--color-info` / `--color-info-bg` | “Open” is availability/information; “granted” remains success. Both pair text labels with color. |
| emissions/revenue uses of accent/secondary | **public-chart hold** | Do not map to platform-local data tokens. `emissions-chart.module.css:19-47` and `revenue-chart.module.css:28-43` remain an explicit migration exclusion until org supplies the public brand-constrained palette. |
| media/hero uses of `#fff`, `rgba(255, 255, 255, 0.7)` | `--color-on-media`, `--color-on-media-muted` | Guaranteed image/video foregrounds adopt org's new shared roles (`brand-tokens-reference.css:54-55,167-168`). |
| status-badge use of `#fff` | retire via constrained status recipe | Text-bearing statuses use status ink over `*-bg`; the current white-on-solid shortcut at `admin-creators.module.css:149-168` is not preserved. |
| `rgba(255, 255, 255, 0.15)` | media-border derivation from `--color-on-media` | Keep the thumbnail badge border as a component-local alpha derivation or a media-border role only if a second consumer appears. |
| `rgba(255, 255, 255, 0.2)`, `rgba(255, 255, 255, 0.24)` | platform-local `--color-media-guide` | The crop guide at `media-picker.module.css:742-743` derives from on-media and remains an editing-tool role. |
| `rgb(16 16 30 / 90%)`, `rgba(8, 9, 17, 0.9)`, `rgba(9, 9, 17, 0.72)`, media uses of `rgba(0, 0, 0, 0.3)`, `rgba(0, 0, 0, 0.5)`, `rgba(0, 0, 0, 0.6)`, `rgba(0, 0, 0, 0.7)` | `--color-overlay`, `--color-overlay-weak`, `--color-overlay-strong` | Collapse backdrop/hover/loading/media scrims to three named strengths. Do not preserve every alpha. Evidence spans `audio-detail-view.module.css:66-78` and `media-picker.module.css:264-266,814`. |
| shadow uses of `rgba(0, 0, 0, 0.2)`, `rgba(0, 0, 0, 0.3)`, `rgba(0, 0, 0, 0.4)`, `rgba(0, 0, 0, 0.5)` | existing `--shadow-xs…xl` | Keep elevation orthogonal and make its token values mode-aware. Literal leaks at `playout.module.css:667` and `content-management-list.module.css:214` migrate to named shadows. |
| creator-foreground uses of `#1a1a2e` | platform-local `--color-on-creator-brand` | Creator-authored color is orthogonal content data, exposed as `--creator-brand`; validate/derive its foreground. It never becomes a fifth voice or overwrites shell accent (`-press-editor.tsx:619,641-642`; `manage-press.module.css:659,674`). |
| `#30273a`, `#d48b37`, `#2c3048`, `#784e62`, `#303044`, `#333344`, `#2d3348`, `#6f4c64`, `#a66d3a`, `#5e4d66`, decorative `#252542`, `#b06f3a` | derived illustration palette | Four preview/placeholder treatments derive from neutral + route-accent mixes. They do not create 12 public tokens. |
| `#5bb5b5`, `rgba(91, 181, 181, 0.1)` | retire by semantic split | The old secondary primitive and tint have no replacement token. Each consumer follows the teal split below. |

**Vendor exemption:** the eleven runtime Simple Icons colors remain untouched; they are
third-party identity data, not platform literals. The generic website/globe `#888888` is
not exempt and maps to muted text. The exact source split is recorded under “Vendor-color
exemption” in the categorization artifact.

### `--color-secondary` split (all current consumers)

| consumer intent / evidence | target |
|---|---|
| Audio labels in `content-management-list.module.css:124-126` | `--color-badge-audio` |
| Info toast in `components/ui/toast.module.css:32-33` | `--color-info` |
| Completed project pills in `routes/projects.module.css:131-133`, `projects-manage.module.css:132-134`, and project detail modules | `--color-success` + `--color-success-bg` |
| Subscribed buttons in `creator-header.module.css:117-118` and `subscription/plan-card.module.css:37-38`; positive pricing copy at `landing-pricing.module.css:51-52` | success tint/ink; CTA interaction still uses the route accent |
| Open sharing in `library.module.css:423-426` | `--color-info` + `--color-info-bg`; granted at `:436-438` is success; inactive is neutral |
| Booking add-date affordance (`booking-form.module.css:78,86`), upload/edit actions, Fediverse action, pricing emphasis | route accent for identity/action; focus and hover move to shared state roles |
| Studio inquiry decoration (`studio-inquiry-form.module.css:24-34`) | route accent (Studio on `/studio`) |
| Public press decoration (`press-sections.module.css:60-172`, `press-carousel.module.css:10`) | route accent (Records on the public press leaf); internal authoring screens stay Parent |
| Media-picker selection/chrome (`media-picker.module.css:64-75,169-170,387-461,598-710`) | state uses → focus/selected/hover; CTA/emphasis → route accent; tool guide → media-guide; ordinary labels → text/muted |
| Library filter/view state and open category (`library.module.css:221-302,348-350,423-426,568-570`) | selected/hover shared state; open → info; loading indicator → route accent |
| Calendar event/project/task categories (`event-card.module.css:43-65,127,141-142`; `calendar-grid.module.css:104-117`) | internal `--color-data-N` series |
| Emissions series (`emissions-chart.module.css:34-41,165-166`) | public-chart hold pending org; never platform-local data color |

### Current token consumer → target contract

Exact counts and file sets are in `.memory/scratchpad/color-categorization.md` Section B.
This consolidation names every currently consumed token.

| current consumer(s) | target / disposition |
|---|---|
| `--color-accent`, `--color-accent-hover`, `--color-accent-bg`, `--color-accent-subtle` | Keep as route-resolved identity aliases. Split out focus, state, badge, and data misuse. Parent subtle is now present in the reference (`brand-tokens-reference.css:63,171`). |
| `--color-bg`, `--color-bg-elevated`, `--color-surface`, `--color-bg-input`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-media-bg` | Keep as mode-aware shared spine roles. Split unsafe foreground uses of `--color-bg` to on-accent/on-media or the constrained badge/status recipe. |
| `--color-bg-hover`, `--color-surface-hover` | Collapse to shared `--color-hover-bg`. |
| `--color-bg-hero-gradient` | Retire; derive gradients from spine surfaces. |
| `--color-error`, `--color-error-bg`, `--color-success`, `--color-success-bg`, `--color-warning`, `--color-info`, `--color-info-bg` | Shared statuses. Add `--color-warning-bg`; remove literal fallbacks once definitions exist. |
| `--color-badge-audio-bg`, `--color-badge-video-bg`, `--color-badge-written-bg` | Retire old `-bg` names; map to `--color-badge-audio/video/written` and the constrained badge component recipe. |
| `--color-overlay-dark`, `--overlay-lock` | Retire; map each use to overlay/weak/strong or media-guide. |
| `--color-link`, `--color-link-hover` | Keep cheap aliases to route accent/hover. Provisional policy is validated in situ, not hardcoded at call sites. |
| `--color-primary`, `--color-primary-text`, `--color-primary-subtle`, `--color-muted`, `--color-text-primary`, `--color-text-secondary`, `--color-text-on-accent`, `--color-text-on-color`, `--color-bg-alt` | Remove without compatibility aliases. Migrate respectively to accent/on-accent/accent-subtle, text-muted/text/text-muted, paired on-* roles, and bg-elevated. `--color-text-on-color` must split by actual surface. |
| `--color-secondary`, `--color-secondary-bg`, `--color-secondary-subtle` | Remove without replacement; follow the per-consumer split above. |
| `--font-ui`, `--font-heading` | Migrate to route-resolved `--font-body`, `--font-display`. |
| `--font-mono` | Keep shared, backed by Fragment Mono. |
| `--font-size-xs`, `--font-size-sm`, `--font-size-base`, `--font-size-lg`, `--font-size-xl`, `--font-size-2xl`, `--font-size-3xl`, `--font-size-xl-fluid`, `--font-size-2xl-fluid`, `--font-size-3xl-fluid`, `--font-weight-normal`, `--font-weight-medium`, `--font-weight-semibold`, `--font-weight-bold` | Keep the shared platform scale/weights; voice changes family, not hierarchy. |
| `--font-size-md` | Retire alias; use `--font-size-base`. |
| `--radius-sm`, `--radius-md`, `--radius-lg` | Keep names as proportional derivatives of route `--radius`. `--radius-xl` remains a derived scale member even though it currently has no consumer. |
| `--radius-circle`, `--radius-pill` | Keep invariant semantic geometry. |

### Contrast policy: no `--color-on-status` or `--color-on-badge`

Platform chooses the **constrained-usage** branch of the org adjudication:

- text-bearing status badges use semantic ink on the paired `*-bg` tint;
- content badges use ordinary `--color-text` over a low-strength category tint, with
  `--color-badge-*` reserved for border/non-text category cue;
- solid status/category colors are allowed only for dots/swatches with no overlaid text.

This avoids a misleading universal “on any status/badge color” guarantee and keeps the
reference vocabulary intact. The current solid status + white shortcut at
`admin-creators.module.css:149-168` and content-card foreground shortcut at
`content-card.module.css:42-68` both migrate to shared badge components. Every resulting
foreground/background pair is an automated WCAG AA matrix case.

### Platform-owned and deferred roles

- Define both-mode, internal-only `--color-data-1…6`; domain aliases may map calendar
  event kinds to the series. Public emissions/revenue series wait on org.
- Keep `--creator-brand` + `--color-on-creator-brand` scoped to authored content.
- Keep `--color-media-guide`, three overlay strengths, and theme-aware elevation local.
- Links alias to accent. `--color-info`/`--color-warning-bg` are first-class.

## Design — Spine-vs-voice conventions (DRAFT for review)

> **DRAFT.** This is proposed canon for the future `platform-patterns.md` entry and the
> AGENTS.md CSS section. This pass does not edit either artifact.

1. **All platform UI is mode-aware.** Never hardcode a color in a feature/component
   stylesheet and never assume the active mode is dark. Consume a semantic token whose
   contract matches the surface. A literal is allowed only in a token definition, a
   verified third-party brand mark, or runtime creator-authored content with its paired
   contrast contract.
2. **Classify color by STATE vs IDENTITY before choosing a token.** A STATE
   (focus, selected background, generic hover background, disabled) is shared spine UI.
   IDENTITY (CTA, link, emphasis, nav-active) breathes with the effective voice. Shared
   statuses, content categories, neutrals, media foregrounds, and data series never become
   voice colors.
3. **Generic components consume route-resolved aliases only:**
   `--color-accent`, `--color-on-accent`, `--color-accent-hover`,
   `--color-accent-bg`, `--color-accent-subtle`, `--radius`, `--font-body`, and
   `--font-display`. They never consume raw `--voice-*` tokens. Body copy and functional
   affordances continue to consume shared spine/status/state roles.
4. **Raw `--voice-*` use is sanctioned only for a voice's signature chip:** Parent
   `MEMBER-OWNED`, Studio `24·96`, TV `● LIVE`, Records `A1`. Signature use may consume
   `--voice-<name>-accent2` only inside the owning chip component; it must not leak into
   buttons, links, status, charts, or generic decoration.
5. **Shape and type breathe through aliases.** Ordinary corners use derived
   `--radius-sm/md/lg` from route `--radius`; circles/pills stay invariant. Components use
   `--font-body`/`--font-display`; `--font-mono` and the type-size/weight scale stay shared.
6. **Color is never the only route/status/category signal.** Preserve text, active-nav,
   icon/shape, or structural cues, and verify required pairings in both modes and all four
   voices.

The current global stylesheet violates these rules by hardcoding dark color scheme
(`global.css:29`), coupling focus to accent (`global.css:79`), and using the old font alias
(`global.css:35`). Those are migration evidence, not exceptions.

## Design — Theming & route mechanism

### Theme attributes and first paint

Use two attributes on `<html>` because preference and applied mode are different facts:

- `data-theme-preference="light|dark|system"` — persisted user choice;
- `data-theme="light|dark"` — the effective mode consumed by CSS.

`system` is therefore first-class without forcing every token file to duplicate a third
mode block. Persist the preference under `snc.appearance.theme`; missing/invalid values
normalize to `system`. A pre-hydration head bootstrap reads the preference, resolves
`matchMedia('(prefers-color-scheme: dark)')`, and sets both attributes before the token
stylesheet paints. While preference is system, subscribe to media-query changes; explicit
light/dark ignores them. Synchronize the `storage` event across tabs. The settings control
in epic child 3 writes the same contract rather than introducing another store.

No-script/system fallback remains valid: `:root` supplies light and a
`prefers-color-scheme: dark` block targets only a root with no `data-theme`; explicit
`[data-theme="light"]` and `[data-theme="dark"]` always win. Set CSS `color-scheme` to the
effective mode and replace the current dark-only meta (`__root.tsx:44`) with a mode-capable
contract. The root document currently has no appearance attributes (`__root.tsx:143`), and
Google font links precede the global stylesheet (`__root.tsx:49-59`), so the bootstrap and
self-hosted font stylesheet must be ordered deliberately to prevent mode/type flash.

### Route voice resolution

The neutral/Parent voice is defined on `:root`; no route attribute is required for the
fallback. A `data-route="studio|tv|records|parent"` attribute belongs on the **leaf route
content container**, not `<html>` and not the persistent shell. This follows the public-only
boundary:

| leaf | route value |
|---|---|
| `/studio` | `studio` |
| `/live` | `tv` |
| `/creators/$creatorId/press/` and its public descendants | `records` |
| `/manage/**`, playout, simulcast, all other leaves | `parent` (usually implicit) |

The leaf boundary matters because `Outlet` is nested inside persistent navigation/player
chrome at `routes/__root.tsx:103-129`; scoping `<html>` would incorrectly recolor internal
shells and portals. Child 2 owns the runtime route/container plumbing. Child 1 owns only the
CSS contract and token declarations that make those attributes meaningful.

Route blocks resolve the generic aliases; components never branch on route names:

```css
:root {
  --color-accent: var(--voice-parent-accent);
  --color-accent-hover: var(--voice-parent-accent-hover);
  --color-accent-bg: var(--voice-parent-accent-bg);
  --color-accent-subtle: var(--voice-parent-accent-subtle);
  --color-on-accent: var(--voice-parent-on-accent);
  --color-link: var(--color-accent);
  --color-link-hover: var(--color-accent-hover);
  --radius: var(--voice-parent-radius);
  --font-body: var(--font-body-parent);
  --font-display: var(--font-display-parent);
}

[data-route="studio"] { /* same aliases → --voice-studio-* */ }
[data-route="tv"] { /* same aliases → --voice-tv-* */ }
[data-route="records"] { /* same aliases → --voice-records-* */ }
```

The later global voice override should add a separate effective-voice attribute rather than
mutate `data-route`; route identity must remain inspectable for “auto.” Its override layer
must repeat the same alias set and have explicit cascade precedence over route defaults.

## Design — Font-loading plan

**Decision: self-host WOFF2 assets.** The six families are open-font families, but
implementation must retain each upstream license file and verify the exact release license
before vendoring. Self-hosting removes Google requests and referrer exposure, works in
local/offline development and controlled deployments, and gives stable caching/versioning.
It replaces the current Google-hosted Inter request at `routes/__root.tsx:49-59`.

| role | family | initial files/weights |
|---|---|---|
| Parent body/display | Source Sans 3 | variable Roman 400–700; italic only if a real consumer requires it |
| Studio body/display | Newsreader | variable Roman 400–700 + italic because editorial copy can use emphasis |
| TV body/display | Saira | variable Roman 400–700 |
| Records body | Archivo | variable Roman 400–700 |
| Records display | Barlow Condensed | 600 and 700 (variable if the upstream package is smaller/equivalent) |
| Shared mono | Fragment Mono | 400 Roman; italic only if consumed |

Add `tokens/fonts.css` with `@font-face`, local WOFF2 URLs, and `font-display: swap`.
Preload only Parent's Source Sans 3 Roman file because it is above-the-fold on every route;
allow route-specific faces to fetch when first used. Do not preload all voices. Use measured
`size-adjust`, `ascent-override`, `descent-override`, and `line-gap-override` fallback metrics
where available to reduce layout shift. The fallback stack remains explicit per family.

`swap` is chosen over blocking FOIT; the brief flash of fallback text is preferable to
invisible navigation/forms. Cache files with content hashes or versioned directories and a
long immutable policy. Subset only after inspecting actual character requirements; preserve
Latin punctuation used by `24·96`, `● LIVE`, and creator names. Current Inter + Georgia
aliases at `typography.css:5-6` remain only until the alias-migration checkpoint.

## Design — Token file structure

Use one composition entry and small files by semantic ownership. Avoid a primitive file that
components can import/consume directly; literal values remain private inside each role file.

```text
apps/web/src/styles/tokens/
├── index.css                 # ordered @imports; sole global entry
├── color/
│   ├── spine.css             # bg/elevated/surface/input/text/border, mode blocks
│   ├── status.css            # success/warning/error/info + paired backgrounds
│   ├── state.css             # focus/selected/hover/disabled
│   ├── media.css             # media bg, on-media, overlay strengths, media guide
│   ├── badges.css            # audio/video/written category roles
│   └── data.css              # platform-local internal --color-data-1…6
├── voices/
│   ├── families.css          # Parent/Studio/TV/Records accent families, both modes
│   └── resolution.css        # Parent defaults + [data-route] generic alias blocks
├── fonts.css                 # @font-face only
├── typography.css            # family aliases + existing sizes/weights/line heights
├── radius.css                # voice bases + generic/derived radius aliases
├── spacing.css
├── elevation.css             # retained, made mode-aware
├── motion.css
└── breakpoints.css
```

`global.css` eventually imports only `tokens/index.css`; existing `color.css` becomes
composition/deletion work rather than a second source. The current seven separate imports at
`global.css:3-9` and backwards shadow alias at `global.css:11-14` collapse into the ordered
entry after consumers migrate.

Each mode-bearing role file follows one block contract, seeded from org's placeholder values:

```css
:root,
[data-theme="light"] {
  /* light placeholders for this file's semantic roles */
}

[data-theme="dark"] {
  /* dark placeholders for the same complete role set */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    /* same dark role set: no-script/system first-paint fallback */
  }
}
```

`families.css` must define a complete shape for every voice in every mode: accent, hover,
bg, subtle, on-accent, accent2, and base radius. Typography family variables may remain
mode-invariant in `typography.css`. `resolution.css` contains **no literal values**—only
aliases from generic component roles to the chosen voice family. Link aliases live there so
reversing the provisional link policy is one edit.

Radius derivation preserves the scale while allowing voice personality. Declare explicit
per-voice variants next to each base (CSS cannot portably multiply a length-valued custom
property), then route-resolve the generic scale:

```css
--voice-parent-radius: 8px;
--voice-parent-radius-sm: 4px;
--voice-parent-radius-md: var(--voice-parent-radius);
--voice-parent-radius-lg: 12px;
--voice-parent-radius-xl: 16px;

--radius: var(--voice-parent-radius);
--radius-sm: var(--voice-parent-radius-sm);
--radius-md: var(--voice-parent-radius-md);
--radius-lg: var(--voice-parent-radius-lg);
--radius-xl: var(--voice-parent-radius-xl);
--radius-circle: 50%;
--radius-pill: 999px;
```

Studio, TV, and Records define the same complete set; Records' ordinary variants remain
square. A token-matrix check enforces ordered/proportional intent and the circle/pill
invariants.

## Design — Refactor discovery

The full evidence and candidate list is in
`.memory/scratchpad/refactor-discovery.md`. Summary:

- Split only where ownership seams are real: `manage-press.module.css` (1,253 lines),
  `media-picker.module.css` (1,083), `library.module.css` (737), and the feature-wide
  `playout.module.css` styling bus (745). Do not combine broad splits with blind token
  replacement; park them for component-coverage expansion.
- Feature modules should consume named semantic `var()` roles. Move repeated alpha recipes
  out of modules; permit `color-mix()` only in token definitions or one reusable component
  whose contract is a derived tint. Current inconsistency is visible in
  `library.module.css:124-471`, `event-card.module.css:43-64`, and
  `audio-detail-view.module.css:66-78`.
- Reuse the global screen-reader utility (`global.css:118`) instead of five module copies;
  consolidate duplicate chart empty/loading/`chartPulse` rules; finish adoption of the
  existing EmptyState and Button/Field/Tabs primitives.
- Verify and prune high-confidence dead candidates: orphaned `manage.module.css`, old live
  player/“also live” blocks (`live.module.css:150-165,322-365`), unused playout selectors,
  and the legacy project-form/item block (`projects.module.css:62-188`).
- Seed `design-system-component-coverage-expansion` with `StatusBadge`,
  `ContentTypeBadge`, chart frame/state primitives, press-editor primitive adoption,
  `AssetMetadataBadge`, and playout style ownership. Badge extraction is the only candidate
  that directly helps this migration by centralizing the contrast contract.

Low-risk cleanup that is necessary for semantic correctness rides with alias/leak migration;
module splits and broader React extraction remain independently reviewable work.

## Design — Execution breakdown proposal

These are proposed checkpoints only; this pass does not create story files or advance stage.
Runtime route plumbing remains sibling feature `brand-voice-route-scoping`; the child-1
“route-scoping” checkpoint below is the CSS/token contract it consumes.

| proposed child story | depends_on | acceptance slice |
|---|---|---|
| `brand-token-architecture-token-restructure` | — | Create composition/file shape; seed complete shared light/dark roles; no consumer changes yet. |
| `brand-token-architecture-theming` | token-restructure | Effective light/dark attributes, system resolution, first-paint bootstrap, persistence contract, and both-mode contrast test harness; no settings UI. |
| `brand-token-architecture-voice-accents` | theming | Define complete four-voice accent/type/radius families and Parent generic defaults using placeholder values. |
| `brand-token-architecture-route-scoping-contract` | voice-accents | Add `[data-route]` alias blocks and route contract tests/fixtures only; child 2 wires real leaf containers. |
| `brand-token-architecture-leak-cleanup` | route-scoping-contract | Map all 96 literals, eliminate non-exempt raw leaks, split secondary uses, centralize badge contrast, and preserve public-chart hold. |
| `brand-token-architecture-font-loading` | voice-accents | Vendor licensed WOFF2 assets, add font faces/fallback metrics, remove Google Inter dependency, verify route-specific loading and offline behavior. May run parallel with leak cleanup. |
| `brand-token-architecture-alias-migration` | leak-cleanup, font-loading | Migrate all color/font/radius consumers, delete compatibility aliases/old token files, run static no-leak check and full visual/contrast matrix. |

The critical path is token restructure → theming → voice accents → route-scoping contract →
leak cleanup → alias migration; font loading branches after voice accents and rejoins before
alias migration.
