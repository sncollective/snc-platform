---
id: brand-token-architecture
kind: feature
stage: review
tags: [design-system]
parent: brand-voice-system
depends_on: []
release_binding: null
gate_origin: null
created: 2026-08-13
updated: 2026-08-14
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

**Current state (audited this session):** **133 distinct color expressions / 338
occurrences across all CSS syntaxes**: 67 hex / 108 occurrences, 29 rgb(a) / 41, four
hsl(a) / 13, 29 `color-mix()` expressions / 35, and four named colors / 141. Thirty-two
distinct expressions occur in the official token layer; 110 occur outside it (nine overlap).
`transparent` and `currentColor` are inventoried but sanctioned semantic CSS keywords, not
leaks. Dark-only (`global.css` hardcodes `color-scheme: dark`; no `data-theme`, no toggle,
no `prefers-color-scheme`). No `data-route` plumbing. Type is Inter + Georgia; the
reference's per-voice families aren't loaded. The reframe is **classifying every current
color expression onto a disciplined semantic role or explicit exemption** (×2 modes), not
chasing a smaller raw-value count. The spec *expands* our semantic surface while
*disciplining* the raw layer.

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

Full color-use categorization (133 expressions, 338 occurrences, 64 token names, ~3,450
`var()` refs) with per-use intent + target role + bin triage:
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
  and stay Parent (spine); ordinary warm UI hexes migrate to neutrals, while fixed PDF/sample
  light/dark surfaces use the internal `--preview-*` output roles. Open follow-on:
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
   `--color-overlay` scrim). The republished reference now also delivers opaque paired status
   backgrounds, host-independent on bg/elevated; platform consumes them and constrains
   text-bearing badges to semantic ink + paired background rather than inventing
   `--color-on-status`/`-on-badge`.
4. **Links → ALIAS to route accent (identity, breathes) — PROVISIONAL.**
   `--color-link: var(--color-accent)`, `--color-link-hover: var(--color-accent-hover)`. Not a
   separate shared role. Validate the reversible alias in situ; org has settled prose/inline
   links as underline-by-default, with structural nav/chrome exceptions.
5. **accent-subtle → reference oversight, org fixing.** Org adds `--voice-parent-accent-subtle`
   (both modes) + exposes `--color-accent-subtle` in route-scoping. Adopt when published.

Five internal categories (overlay/creator-brand/gradients/editing-guides/elevation) — org
confirms platform owns them. Org is publishing the reference extension (items 1, 3, 5) now;
adopt their exact token names verbatim when it lands.

## Open questions the brief must still resolve

- **Teal decorative per-use mapping** — booking / landing-pricing / subscription /
  studio-inquiry / press-decoration consumers → assign each to route accent / success /
  info / neutral (no generic secondary).
- **Creator-brand color coexistence** — confirm orthogonal data (not a fifth voice);
  pending the org principle on creator-authored colors.
- **Hero-gradient token** — derive from bg/bg-elevated/surface, or retain a documented
  mode-aware hero-surface role.
- **Warning/info promotion** — warning → first-class with spec value; add `--color-info`
  (#1565C0), resolving latent fallbacks in team-section + playout. (Mostly mechanical.)
## Epic: brand-voice-system

This feature is **child 1 (token foundation)** of the `brand-voice-system` epic. Its active
siblings are:
- `brand-voice-route-scoping` (child 2) — the sole MVP route-default voice mechanism.
- `brand-voice-export-theming` — wire voice tokens into the existing Playwright PDF render.

The previously considered `brand-voice-user-toggle` is **deferred and parked**, not an active
sibling or part of this feature. Cross-cutting locked decisions (STATE/IDENTITY rule,
public-facing principle, voice→route map, org gap adjudications) live in the epic.

## Brief deliverables (what "done" looks like for this feature's design phase)

1. **Mapping table** — every one of the 133 current color expressions → target role or
   explicit exemption (neutral ramp / status / badge / voice accent / intrinsic CSS keyword /
   sanctioned bridge), with the collapses and retires called out.
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
An expression appears in more than one row only when identical current values carry more
than one meaning. The source inventory is reproducible at 133 distinct expressions / 338
occurrences across hex, rgb(a), hsl(a), named colors, and modern color functions; the
current token layer starts at `apps/web/src/styles/tokens/color.css:5-17` and the complete
per-syntax inventory is in the scratchpad. Unless a citation is project-rooted, its
path is relative to `apps/web/src/`, matching the categorization artifact.

### Raw literal → target role

| current literal(s) | target role | migration ruling |
|---|---|---|
| four HSL fallbacks / 13 occurrences | success/info/warning roles | Remove consumer fallbacks and use the semantic roles: `hsl(140 50% 15%)` + `hsl(140 60% 45%)` (`styles/form.module.css:82,83,85`, `playout.module.css:223`, `simulcast.module.css:91`, `simulcast-destination-manager.module.css:90`), info `hsl(210 80% 60%)` (`playout.module.css:211`), warning `hsl(40 90% 55%)` (`styles/tokens/color.css:68`; `playout.module.css:217,295,296,306,554`). |
| named `white` / `green` | `--color-on-media` / `--color-success` | Replace named pigments at `live.module.css:73` and `join-manage.module.css:114`. Standalone `transparent` (133 occurrences) and `currentColor` (six) are inventoried sanctioned semantic CSS keywords, not raw-pigment exemptions. |
| 29 `color-mix()` expressions / 35 occurrences | semantic role or token-owned derivation | Retire primary/secondary compatibility mixes, map status/state/surface/media recipes to their semantic homes, and permit any surviving derivation only in its owning token-definition file. Full values and `file:line` evidence are in the categorization artifact's “Modern color functions” table. No other modern color function is present. |
| `#000`, `#0c0c14`, `#171723` | `--color-media-bg` | Mode-invariant media wells. The two near-black picker values collapse into the existing media role (`media-picker.module.css:248,591,706`). |
| `#171725`; preview-surface uses of `#1a1a2e` | fixed `--preview-dark-paper` | `.pdfDark` and `.darkSurface` are fixed output/sample previews, independent of the UI mode (`manage-press.module.css:577-582,668-674`). |
| non-output `#20203a` | `--color-bg` | Draft UI preview chrome collapses to the spine background; it is not one of the fixed light/dark output surfaces (`manage-press.module.css:932`). |
| `#252542`, `#2a2a46`, `#2b2741`, `#343451` | `--color-bg-elevated` / `--color-surface` | Collapse by role: containers/dropdowns → elevated; subordinate cards → surface. The decorative `#252542` occurrence at `manage-press.module.css:825` is illustration, not a surface. |
| `#2a2a4a` | `--color-bg-input` | Current input primitive keeps its role. |
| `#f6f0e7`, `#f2ede4` | fixed `--preview-light-paper` | `.lightSurface`, PDF paper, and split-preview paper describe a fixed light output/sample, not the active UI mode (`manage-press.module.css:494,569,586,672-674`). |
| `rgb(255 255 255 / 3%)` | `--color-surface` | Replace the literal preview-card veil at `manage-press.module.css:1033` with the mode-aware surface role. |
| `#1e1e36` | retire `--color-bg-hero-gradient` | Derive each hero gradient from `--color-bg`, `--color-bg-elevated`, and `--color-surface`; do not preserve a fourth navy step. Current consumers are identified in the scratchpad. |
| `#ddd8ce`; preview-ink use of `#1a1a2e` | fixed `--preview-dark-ink` / `--preview-light-ink` | `.pdfDark` fixed light ink and `.lightSurface` fixed dark ink remain output semantics (`manage-press.module.css:581-582,672-674`). |
| `#f0f0f0`, `#d1d1d9` | `--color-text` | Collapse ordinary body/admin ink to the mode-aware primary text role. |
| `#a0a0b0`, `#666`, `#888888`, `#c7c7d1`, `#6b7280` | `--color-text-muted` | Collapse muted copy, generic website icon, and inactive label ink. Inactive badges become neutral tint + muted ink, not a solid status fill. |
| `#3a3a5c`, `#505078`, `#6b6b89` | `--color-border` | Collapse dialog, placeholder, and spine outlines. |
| `#1a1a1a`, `#f5a623`, `#e09510`, `#ffd486`, `rgba(245, 166, 35, 0.1)` | route `--color-accent` / `--color-accent-hover` / `--color-accent-bg` | The generic CTA fallbacks remain identity roles, but all amber values retire. The active voice supplies the replacement. |
| `#ffd27a` | split: `--color-focus`, route accent, or `--color-warning` | Focus uses at `manage-press.module.css:31,452` become shared focus; lifecycle accent at `:220` becomes route accent; template limit at `:484` becomes warning. The literal retires. |
| `#231805`, `#251a08`, CTA uses of `#fff` | `--color-on-accent` | Replace dark-mode assumptions with the route-paired foreground. Current button shortcuts are visible at `library.module.css:33-61` and `global.css:134-144`. |
| `#8fd1d1`; selected/filter uses of `#9ed8d8`; `rgba(255, 255, 255, 0.05)` | `--color-selected-bg`, `--color-hover-bg`, plus normal `--color-text` | Selection is a shared state, not a teal identity. Selected controls use the state background and ordinary text; the two duplicate hover primitives collapse to `--color-hover-bg`. |
| focus uses of current accent | `--color-focus` | Global and component focus rules stop consuming identity. `global.css:79` and `button.module.css:24-25` show the current accent coupling. |
| `#4caf50`, `#16a34a`, `#8bd98f`, `#92dd96`, `#93e69a`, `#b6eeb8` | `--color-success` | Collapse all positive/ready/completed/granted inks. Completed, subscribed, and granted are success semantics. |
| `#ef5350`, `#c0392b`, `#ff8b88`, `#ff9d9a`, `#ffaaa8`, `#ffb4b1`, `#ffd0ce` | `--color-error` | Collapse danger, denied/failed grants, failures, and error fallback inks. |
| archived use of `#dc2626` | neutral status recipe | Archived is a neutral lifecycle label, not an error. |
| `#ffc45b`, `#ffd276`, warning use of `#ffd27a`, `#ffe0a4`, needs-grant use of `#ff9c99` | `--color-warning` | Dirty, blocked, limit, visibility, pending, and needs-grant states become the first-class warning role. |
| `#1a73e8`, `#e8f0fe` | `--color-info`, `--color-info-bg` | Define the missing pair. The blue fallback at `team-section.module.css:114-115` and the separate playout consumer converge. `#1a73e8` is not vendor-exempt. |
| `rgba(239, 83, 80, 0.1)`, `rgba(76, 175, 80, 0.1)` | `--color-error-bg`, `--color-success-bg` | Existing tint definitions keep their semantic roles but take the reference's mode-specific placeholders. |
| project-completion use of `rgba(91, 181, 181, 0.2)` | `--color-success-bg` | Completed projects are success; the same literal's calendar use is categorical and maps separately. |
| `rgba(245, 166, 35, 0.85)`, `rgba(91, 181, 181, 0.85)`, `rgba(160, 160, 176, 0.6)` | `--color-badge-video`, `--color-badge-audio`, `--color-badge-written` | Replace current badge-fill aliases with the reference's category roles and desaturated placeholders. |
| `rgba(239, 83, 80, 0.2)`, calendar uses of `rgba(245, 166, 35, 0.2)`, `rgba(245, 166, 35, 0.3)`, `rgba(91, 181, 181, 0.2)`, `rgba(91, 181, 181, 0.25)`, `rgba(91, 181, 181, 0.3)`, `rgba(91, 181, 181, 0.4)` | internal `--color-data-1…6` + derived tints | Calendar categories are platform-local data roles. Domain aliases map event types to the series; no voice or status token doubles as a category. |
| open-sharing use of `#9ed8d8` | `--color-info` / `--color-info-bg` | “Open” is availability/information; “granted” remains success. Both pair text labels with color. |
| emissions/revenue uses of accent/secondary | temporary `--legacy-public-chart-*` bridge | Public charts remain org-constrained. Until org delivers that palette, `color/data.css` owns lint-exempt `--legacy-public-chart-emissions-*` / `--legacy-public-chart-revenue-*` aliases carrying the current accent/secondary/status chart colors (`emissions-chart.module.css:19-47`; `revenue-chart.module.css:28-43`). Owner: this feature. Expiry: org public-chart palette delivery. Alias migration is incomplete and must fail acceptance while any bridge name exists. |
| media/hero uses of `#fff`, `rgba(255, 255, 255, 0.7)` | `--color-on-media`, `--color-on-media-muted` | Guaranteed image/video foregrounds adopt org's new shared roles (`brand-tokens-reference.css:54-55,167-168`). |
| status-badge use of `#fff` | retire via constrained status recipe | Text-bearing statuses use status ink over `*-bg`; the current white-on-solid shortcut at `admin-creators.module.css:149-168` is not preserved. |
| `rgba(255, 255, 255, 0.15)` | media-border derivation from `--color-on-media` | Keep the thumbnail badge border as a component-local alpha derivation or a media-border role only if a second consumer appears. |
| `rgba(255, 255, 255, 0.2)`, `rgba(255, 255, 255, 0.24)` | platform-local `--color-media-guide` | The crop guide at `media-picker.module.css:742-743` derives from on-media and remains an editing-tool role. |
| `rgb(16 16 30 / 90%)`, `rgba(8, 9, 17, 0.9)`, `rgba(9, 9, 17, 0.72)`, media uses of `rgba(0, 0, 0, 0.3)`, `rgba(0, 0, 0, 0.5)`, `rgba(0, 0, 0, 0.6)`, `rgba(0, 0, 0, 0.7)` | `--color-overlay`, `--color-overlay-weak`, `--color-overlay-strong` | Collapse backdrop/hover/loading/media scrims to three named strengths. Do not preserve every alpha. Evidence spans `audio-detail-view.module.css:66-78` and `media-picker.module.css:264-266,814`. |
| shadow uses of `rgba(0, 0, 0, 0.2)`, `rgba(0, 0, 0, 0.3)`, `rgba(0, 0, 0, 0.4)`, `rgba(0, 0, 0, 0.5)` | existing `--shadow-xs…xl` | Keep elevation orthogonal and make its token values mode-aware. Literal leaks at `playout.module.css:667` and `content-management-list.module.css:214` migrate to named shadows. |
| creator-foreground use of `#1a1a2e` | platform-local `--color-on-creator-brand` | Creator-authored color is orthogonal content data, exposed as `--creator-brand`; validate/derive its foreground. It never becomes a fifth voice or overwrites shell accent (`-press-editor.tsx:619,641-642`; `manage-press.module.css:659`). |
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
| Emissions series (`emissions-chart.module.css:34-41,165-166`) | temporary owner+expiry `--legacy-public-chart-*` bridge pending org; never platform-local data color |

### Status-semantics contract

| product state | semantic treatment |
|---|---|
| completed / subscribed / granted | success ink + opaque paired success background |
| open / informational availability | info ink + opaque paired info background |
| archived / inactive | neutral text + neutral surface/border |
| pending / needs grant | warning ink + opaque paired warning background |
| denied / failed grant / failed operation | error ink + opaque paired error background |

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

- text-bearing status badges use semantic ink on the paired opaque `*-bg` value;
- content badges use ordinary `--color-text` over a low-strength category tint, with
  `--color-badge-*` reserved for border/non-text category cue;
- solid status/category colors are allowed only for dots/swatches with no overlaid text.

Org has now delivered the corrected dark Parent hover (`#8E9AAC` at
`brand-tokens-reference.css:139`) and host-independent opaque dark status backgrounds
(`brand-tokens-reference.css:122-130`), permitted on both `--color-bg` and
`--color-bg-elevated` at 5.9–7.4:1; platform adopts those values rather than tuning local
composites. The current solid status + white shortcut at
`admin-creators.module.css:149-168` and content-card foreground shortcut at
`content-card.module.css:42-68` both migrate to shared badge components. The platform
contrast harness mirrors org's verification matrix: foreground/background and
foreground/elevated pairs, both modes, and base + hover + disabled + tint-composite cases.

### Platform-owned and deferred roles

- Define both-mode, internal-only `--color-data-1…6`; domain aliases may map calendar
  event kinds to the series. Public emissions/revenue use the temporary owner+expiry
  `--legacy-public-chart-*` bridge until org delivers its palette; the bridge blocks alias
  migration completion.
- `color/preview.css` owns fixed, internal, non-mode-aware `--preview-light-paper`,
  `--preview-light-ink`, `--preview-dark-paper`, and `--preview-dark-ink`.
- `color/illustration.css` owns the internal decorative palette, derived from shared neutrals
  plus the route accent; feature styles do not retain the twelve raw illustration literals.
- `color/creator.css` owns the creator-brand contrast contract: runtime orthogonal
  `--creator-brand` data is paired with validated/derived `--color-on-creator-brand`, scoped
  to authored content.
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
6. **Links breathe but stay identifiable.** Prose/inline links use the route-resolved link
   aliases and are underlined by default; structural nav/chrome links are the documented
   exception. This org-approved rule is verified during in-situ link validation in every
   mode/voice combination.
7. **Color is never the only route/status/category signal.** Preserve text, active-nav,
   icon/shape, or structural cues, and verify required pairings in both modes and all four
   voices.

### STATE vs IDENTITY recipe

| ambiguous control | classification | token recipe |
|---|---|---|
| active tab | STATE (shared) | `--color-selected-bg` + ordinary text/border; do not use route accent as the sole selected cue |
| checked checkbox/radio/switch | STATE (shared) | shared selected/focus/disabled roles; retain the native checked mark or icon |
| current workflow step | STATE (shared) | shared selected role; completed → success, pending/blocked → warning, failed → error |
| active navigation item | IDENTITY (breathes) | route `--color-accent` plus structural/current-page cue |
| destructive action | STATE/functional (shared) | `--color-error` + paired opaque error background; never a voice accent |

### Enforceable boundary

Land an early stylelint/scan rule that rejects raw color literals outside token-definition
files. Its grammar covers hex, rgb(a), hsl(a), named colors, and modern color functions.
Explicit allowlists are limited to token-definition files, verified vendor identity colors,
runtime creator-brand injection, sanctioned signature-chip definitions, and the temporary
owner+expiry `--legacy-public-chart-*` bridge. `transparent` and `currentColor` are classified
semantic CSS keywords; named pigments are not. The `alias-migration` acceptance slice named
**“Publish and enforce the spine-vs-voice convention”** lands this draft in
`platform-patterns.md` and the AGENTS.md CSS section and turns the scan on.

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
normalize to `system`.

The lifecycle has exactly two actors:

1. A **set-only inline bootstrap** runs before React and before the token stylesheet. It
   safely reads storage, resolves `matchMedia('(prefers-color-scheme: dark)')`, and sets the
   two attributes. It installs no listeners, creates no store, and performs no later work.
2. Exactly one **hydrated appearance controller** owns all subsequent state. Its
   `applyPreference(light|dark|system, source)` operation is idempotent, writes attributes
   only when values differ, persists only local user changes, and never creates a second
   controller/listener set. Safe storage read/write wrappers catch `localStorage` access and
   mutation failures under privacy/security settings and fall back to `system` without
   throwing.

The hydrated controller binds the media-query listener only while preference is `system`;
every preference transition tears down the prior listener before rebinding. It also handles
`storage` events for `snc.appearance.theme` (including removal/invalid values → `system`) so
tabs converge without writing the event back. An explicit valid storage preference wins over
a queued media change: media callbacks capture a controller generation and re-check that the
current preference is still `system` before applying. Preference changes therefore cannot be
overwritten by an already-queued system event.

`<html>` carries `suppressHydrationWarning` (or the framework-equivalent explicit ownership)
so React preserves bootstrap-owned attributes during hydration; the hydration test asserts
both attributes survive unchanged. Place the inline bootstrap immediately **before**
`<HeadContent />` in `RootDocument`; keep the global/token stylesheet emitted by
`HeadContent`, which guarantees bootstrap-before-stylesheet ordering (`__root.tsx:49-59,143-146`).
The mode settings control writes through the one controller rather than introducing another
store.

No-script/system fallback remains valid: `:root` supplies light and a
`prefers-color-scheme: dark` block targets only a root with no `data-theme`; explicit
`[data-theme="light"]` and `[data-theme="dark"]` always win. If CSP blocks the inline
bootstrap, this no-attribute CSS path still paints the system mode and hydration later takes
ownership. A stored explicit preference may flash as system until hydration in that failure
case; that degradation is accepted and documented rather than adding a second bootstrap.
Set CSS `color-scheme` to the effective mode and replace the current dark-only meta
(`__root.tsx:44`) with a mode-capable contract.

Named lifecycle tests: invalid storage value; blocked storage read/write; cross-tab storage
events; system change while system-pinned; bootstrap failure/CSP fallback; hydration
attribute preservation; and the queued-media-versus-explicit-preference tiebreak. The
contrast harness mirrors org: foreground/background and foreground/elevated pairs, both
modes, base + hover + disabled + tint composites.

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
  --color-accent2: var(--voice-parent-accent2);
  --color-link: var(--color-accent);
  --color-link-hover: var(--color-accent-hover);
  --radius: var(--voice-parent-radius);
  --font-body: var(--font-body-parent);
  --font-display: var(--font-display-parent);
}

[data-route="studio"] { /* same aliases → --voice-studio-* */ }
[data-route="tv"] { /* same aliases → --voice-tv-* */ }
[data-route="records"] { /* same aliases → --voice-records-* */ }

/* Required because body already resolved --font-body outside the route scope. */
[data-route] { font-family: var(--font-body); }
```

Overriding `--font-body` on a subtree does not recompute a `font-family` already resolved on
`<body>`; `voices/resolution.css` therefore owns `[data-route] { font-family:
var(--font-body); }`. Headings already resolve `--font-display` on each heading element.
Child 2's route-container boundary consumes this rule and tests computed `font-family`
inside each scoped subtree.

`data-effective-voice` is the reserved name for a possible future override seam. It is
**deferred-not-built** in this epic; no override attribute, cascade layer, auto mode, or
user voice control ships now. Child 2 owns the runtime note while this feature reserves only
the name and keeps `data-route` inspectable.

## Design — Font-loading plan

**Decision: self-host via Fontsource (npm packages).** The six families are SIL OFL and ship
from our own origin. This replaces the Google-hosted Inter request at
`routes/__root.tsx:49-59`.

The manifest is consumer-verified rather than aspirational:

| role / family | loaded weights and styles | consumer evidence | exact fallback stack |
|---|---|---|---|
| Parent body/display — Source Sans 3 | variable Roman 400–900; true italic 400–600 | Parent tooling reaches 800/850 (`library.module.css:18,50,104,186,474,674`; `media-picker.module.css:268,476,601,887`). Real italic is required by admin/content consumers: `playout.module.css:72,118,196,617,698`, `simulcast.module.css:216`, `simulcast-destination-manager.module.css:205`, `booking-list.module.css:41`, `subscription-list.module.css:60`, `audio-detail.module.css:54`, `audio-detail-view.module.css:129`, `audio-locked-view.module.css:41,43`, and `emissions.module.css:195`. | `"Source Sans 3", Arial, sans-serif` |
| Studio body/display — Newsreader | variable Roman 400–700; no italic file until a real Studio consumer exists | Studio body uses normal/600 and display headings require the shared 700 ceiling (`studio-equipment.module.css:6,25,27`; `studio-service-section.module.css:9,50`; `studio-inquiry-form.module.css:6,32`; `studio-hero.module.css:15,22`; heading elements at `studio-hero.tsx:11`, `studio-service-section.tsx:80`, `studio-equipment.tsx:34,38`, `studio-inquiry-form.tsx:84,95`). | `Newsreader, Georgia, "Times New Roman", serif` |
| TV body/display — Saira | variable Roman 400–700; true italic 400 | `/live` uses 500/600/700 (`live.module.css:71,193,211,318,329,356`) and italic director copy (`live.module.css:447`). | `Saira, "Arial Narrow", Arial, sans-serif` |
| Records body — Archivo | variable Roman 400–700; no italic file (no public-press italic consumer) | Public press body uses normal, semibold, and bold (`press-sections.module.css:60,72,74,126,158,172,174,190`; `press-carousel.module.css:11,13`). | `Archivo, Arial, sans-serif` |
| Records display — Barlow Condensed | variable Roman 400–700; no italic file | Weight 400 is load-bearing in display shorthands (`press-sections.module.css:47,119,159`); bold display is consumed at `press-sections.module.css:83`. | `"Barlow Condensed", "Arial Narrow", Arial, sans-serif` |
| Shared mono — Fragment Mono | static Roman 400; no italic file | Current mono consumers request the shared face without italic (`playout.module.css:605`; `simulcast.module.css:82`; `simulcast-destination-manager.module.css:81`; `join-manage.module.css:39`; `streaming.module.css:77,129,169`). | `"Fragment Mono", "Cascadia Mono", "Liberation Mono", "Courier New", monospace` |

Install `@fontsource-variable/{source-sans-3,newsreader,saira,archivo,barlow-condensed}` and
static `@fontsource/fragment-mono`; import only the manifest's Roman/italic faces. **Synthetic
italics are forbidden** (`font-synthesis: none` at the document contract): load a real italic
face where the table names a consumer, and do not invent italics for families without one.

Subset baseline is `latin` + `latin-ext` for every family; do not hand-trim Unicode ranges.
Before acceptance, inspect the shipped WOFF2 cmap and render fixtures for U+00B7 (`24·96`),
U+25CF (`● LIVE`), and multilingual creator names. Where a primary face lacks a creator's
script, the named system fallback must cover it; add a Fontsource script subset when the
family supplies one. Do not claim coverage from package labels alone.

Use `font-display: swap`. Preload only Parent Source Sans 3 Roman; voice-specific and italic
faces load on demand. Cache content-hashed/versioned assets immutably. **Defer fallback-metric
`@font-face` overrides** until measured CLS evidence justifies them: no guessed
`size-adjust`/ascent/descent values. The exact plain stacks above are the initial fallback
layer. Current Inter + Georgia aliases at `typography.css:5-6` remain only until the
alias-migration checkpoint.

## Design — Token file structure

Use one composition entry and small files by semantic ownership. Avoid a primitive file that
components can import/consume directly; literal values remain private inside each role file.

```text
apps/web/src/styles/tokens/
├── index.css                 # ordered @imports; sole global entry
├── color/
│   ├── spine.css             # bg/elevated/surface/input/text/border, mode blocks
│   ├── status.css            # success/warning/error/info + opaque paired backgrounds
│   ├── state.css             # focus/selected/hover/disabled
│   ├── media.css             # media bg, on-media, overlay strengths, media guide
│   ├── badges.css            # audio/video/written category roles
│   ├── data.css              # internal data roles + temporary legacy public-chart bridge
│   ├── preview.css           # fixed internal --preview-light/dark-paper/ink
│   ├── illustration.css      # internal neutral + route-accent decorative derivations
│   └── creator.css           # creator-brand data/validated foreground contract
├── voices/
│   ├── families.css          # voice COLOR roles only, both modes; no radius/font aliases
│   └── resolution.css        # EVERY route-resolved generic alias + scoped font-family rule
├── fonts.css                 # Fontsource face imports/declarations only
├── typography.css            # per-family source variables + shared size/weight/line-height
├── radius.css                # per-voice base + sm/md/lg/xl values ONLY
├── geometry.css              # invariant --radius-circle / --radius-pill
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

The ownership rule is strict: **every token has exactly one declaration owner**.
`families.css` owns only each voice's color roles in both modes: accent, hover, bg, subtle,
on-accent, and accent2—no radius or font aliases. `radius.css` owns only each voice's base +
sm/md/lg/xl radius values. `typography.css` owns the mode-invariant per-family source
variables. `resolution.css` owns **every route-resolved generic alias**: all accent/link
colors, `--radius` + sm/md/lg/xl, `--font-body`, `--font-display`, and the `[data-route] {
font-family: var(--font-body); }` scope rule. It contains **no literal values**. Invariant
circle/pill geometry lives in `geometry.css`, not in either route-resolution owner.

Radius derivation preserves the scale while allowing voice personality. Declare explicit
per-voice variants in `radius.css` (CSS cannot portably multiply a length-valued custom
property), then declare the generic scale only in `voices/resolution.css`:

```css
--voice-parent-radius: 8px;
--voice-parent-radius-sm: 4px;
--voice-parent-radius-md: var(--voice-parent-radius);
--voice-parent-radius-lg: 12px;
--voice-parent-radius-xl: 16px;

/* voices/resolution.css — aliases only */
--radius: var(--voice-parent-radius);
--radius-sm: var(--voice-parent-radius-sm);
--radius-md: var(--voice-parent-radius-md);
--radius-lg: var(--voice-parent-radius-lg);
--radius-xl: var(--voice-parent-radius-xl);

/* geometry.css — invariant literals */
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
  out of modules; permit `color-mix()` only in the owning token-definition file. Current inconsistency is visible in
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
| `brand-token-architecture-token-restructure` | — | Create the one-owner file shape; seed complete shared light/dark roles; pin `<html data-theme="dark">` when imports land, removing the pin only with theme activation. |
| `brand-token-architecture-theming` | token-restructure | Set-only bootstrap + one hydrated controller lifecycle; safe storage/listener/sync behavior; mode settings control; org-mirrored contrast harness across bg/elevated, both modes, base/hover/disabled/tint composites. |
| `brand-token-architecture-voice-accents` | theming | Define complete four-voice color families, per-voice radii in their sole owner, and Parent generic defaults. |
| `brand-token-architecture-route-scoping-contract` | voice-accents | Add every `[data-route]` alias plus scoped `font-family` recomputation and computed-style fixtures only; child 2 wires real leaf containers. |
| `brand-token-architecture-leak-cleanup` | route-scoping-contract | Classify all 133 expressions, enforce the all-syntax grammar, split secondary/status/preview uses, centralize badge contrast, and install the temporary public-chart bridge. |
| `brand-token-architecture-font-loading` | voice-accents | Vendor the consumer-verified Fontsource manifest, real required italics, plain named fallback stacks, glyph/subset checks, and no Google request. May run parallel with leak cleanup. |
| `brand-token-architecture-alias-migration` | leak-cleanup, font-loading | Migrate all consumers, publish/enforce conventions, delete compatibility aliases/old files, run all-syntax no-leak + org-mirrored visual/contrast matrix, and fail while the public-chart bridge remains. |

The critical path is token restructure → theming → voice accents → route-scoping contract →
leak cleanup → alias migration; font loading branches after voice accents and rejoins before
alias migration.

## Review — adversarial pass (2026-08-14)

Verdict: **needs rework** (architecture affirmed; gaps in implementability/precision). Findings
adjudicated by operator + orchestrator:

- **B2 (light-mode exposure sequencing) — OVERRULED in severity by operator:** stories ship as
  one release, not hot-deployed; no user-facing intermediate states; the final matrix in
  `alias-migration` verifies the shipped end state. Surviving kernel (minor): the new mode
  contract puts light on `:root`, so importing the new files mid-migration flips dev light —
  guard = pin `data-theme="dark"` until the activation story (add to `token-restructure`
  acceptance). Light-touch story trims only; no re-slice.
- **B4 portal half + GlobalPlayer + override-seam CSS — ALREADY COVERED** by child 2's design
  (RouteVoiceOutlet, portal Positioner attributes, chat portal, `data-effective-voice`
  precedence). Surviving kernel: **font-family trap** — `--font-body` on a scope doesn't
  recompute already-resolved `font-family`; route scope must set
  `font-family: var(--font-body)` explicitly. Fold into child 1's CSS contract + child 2's
  boundary.
- **B3 (placeholder contrast failures) — SPLIT:** dark-Parent hover omission (~1.28:1) is a
  reference bug → org. Opaque paired status backgrounds + enumerated host surfaces + hover/
  disabled matrix cases → ours (mapping-table fix).
- **B1 (public-chart hold vs `--color-secondary` deletion) — ACCEPTED:** make the org
  public-chart palette a dep of alias deletion, or define an owner+expiry lint-exempt
  `--legacy-public-chart-*` bridge. Never claim migration complete while it remains.
- **M1 PDF-preview colors — ACCEPTED:** fixed scoped `--preview-*` roles (output semantics,
  not mode-aware spine).
- **M2 HSL literals missed — ACCEPTED:** re-run inventory across all color syntaxes
  (hex/rgb/hsl/named/color functions); fix the no-leak checker grammar likewise.
- **M3 bootstrap lifecycle — ACCEPTED:** set-only bootstrap + one hydrated controller, safe
  storage wrappers, listener teardown, `suppressHydrationWarning`, CSP fallback behavior.
- **M4 accent links non-color distinction — ACCEPTED + org flag:** underline prose links by
  default (1.4.1 fails in 7/8 mode/voice combos); part of in-situ link validation.
- **M5 font manifest mismatches — ACCEPTED:** route-by-route weight/style/glyph manifest
  (Barlow 400 consumers, Source Sans 800 consumers, italic consumers, `●`/multilingual
  glyphs); exact fallback faces or defer metric overrides.
- **M6 token ownership contradictions — ACCEPTED:** one owner per token (`families.css` =
  voice colors only; `radius.css` = per-voice radii only; `resolution.css` = all
  route-resolved aliases); home the preview + illustration + creator-brand contracts.
- **M7 stale override language — ACCEPTED:** clean residual active-toggle wording.
- **M8 story bundling — PARTIAL:** trim the fattest stories; not the safety-driven re-slice.
- **m1 archived/needs-grant semantics — ACCEPTED:** archived → neutral; needs-grant →
  warning; denied/failed → error.
- **m2 conventions enforceability — ACCEPTED:** recipe table for ambiguous states; early
  stylelint/scan rule; explicit allowlists; land the platform-patterns/AGENTS update as a
  named acceptance slice.

Sound per reviewer: attribute split, media/overlay/secondary-split mappings, Fontsource
direction, refactor-discovery parking.

## Implementation summary (autopilot drain, 2026-08-14)

All seven child stories landed as chained waves (one implementer per story, gpt-5.6-sol/luna):

- `token-restructure` (49e7689) — one-owner token shape + shared light/dark roles + dark migration pin + structural contract tests.
- `theming` (2d31062) — set-only bootstrap + single hydrated appearance controller + `/settings` light/dark/system control + named lifecycle tests + computed contrast harness.
- `voice-accents` (ae76d67) — four voice color families both modes, per-voice proportional radii, literal-free Parent defaults in `voices/resolution.css`, prose-link underline default.
- `route-scoping-contract` (32f8aaf) — `[data-route]` alias blocks (studio/tv/records) + font-family scope rule + structural resolution fixtures (jsdom custom-property limitation documented).
- `font-loading` (1fc7cb4, closed 19a6b0d) — six Fontsource families self-hosted, true italics, exact fallback stacks, WOFF2 cmap glyph tests, Google request removed. Adjudicated deviation: static Barlow Condensed (`@fontsource-variable/barlow-condensed` not on npm — registry 404 verified).
- `leak-cleanup` (4b64ae2, closed 9faf150) — all authored CSS migrated to semantic roles, `--color-secondary` retired, `--legacy-public-chart-*` bridge installed owner+expiry, all-syntax no-leak checker (CSS face), contrast matrix extended. Boundary fix: two TSX literals migrated by orchestrator per mapping table.
- `alias-migration` (0555bab) — full vocabulary migration (124 files), legacy aliases + old color.css/legacy dir deleted, org public-chart palette adopted as `--color-chart-*` (org published 2026-08-14 ~10:55; bridge deleted), conventions published to `.claude/rules/platform-patterns.md` + AGENTS.md CSS section, checker extended to CSS-in-TSX face, contrast matrix complete (both modes, all voices, composites).

**Integrated verification:** `bun run --filter @snc/web test` 1,987/1,987 green; `bun run --filter @snc/web build` green; zero legacy-vocabulary hits repo-wide; no-leak checker zero non-exempt violations across both faces.

External-gate outcomes: org public-chart palette DELIVERED (hard gate cleared mid-drain); stakeholder value swap remains the documented follow-up (placeholder-standing values, one-pass swap on sign-off).

## Review — standard pass (2026-08-14)

Verdict: **needs fixes**. Receiver-confirmed findings and dispositions:

- **B1 / FIX 1 — robust accent-background consumer pairing:** re-paired the context-shell desktop and mobile active navigation states to `--color-selected-bg` with an inset accent structural cue; the media-picker empty/dropzone states and press-editor current state received the same STATE/IDENTITY treatment. The requested repository audit also found older text-bearing `--color-accent-bg` consumers outside this worker's exclusive write set (including creator, calendar, landing, library, notifications, and the sibling-owned press image picker); those were not edited across the ownership boundary and remain a caller-visible residual. The contrast harness now computes accent-over-selected pairings for every voice/mode and the solid on-accent pairings used by controls. Org's missing dark Parent `--voice-parent-accent-bg` reference value is flagged to org; platform's selected-state pairing is the mitigation for the owned consumers and does not depend on that value.
- **B2 / FIX 2 — fixed/overlay foreground assumptions:** moved the audio cover control and press media caption/carousel foregrounds to on-media roles, and changed accent-hover/control foregrounds to `--color-on-accent`. A direct module sweep found no additional owned fixed media/overlay `--color-text` pair beyond the named files; the harness now verifies on-media over media black and on-accent over each voice accent in both modes.
- **I1 / FIX 3 — creator-brand fallback:** `creator.css` now makes the no-curated-color contract `--color-accent` + `--color-on-accent`; the existing inline-style DOM state selects the fixed curated ink only when a validated preset is present, without changing sibling-owned `-press-editor.tsx`. Harness cases cover every shared creator preset plus every voice fallback in both modes.
- **I2 / FIX 4 — fail-closed CSS-in-TSX grammar:** expanded inline-style enforcement across color-bearing shorthands/properties, shadows, background images, filters, and custom-property assignments; narrowed the signature-chip exception to exact voice `accent2` references with no raw-literal exemption; added explicit rejection fixtures for every prior bypass while retaining `transparent`/`currentColor` as semantic keywords.
- **I3 / FIX 5 — media badge border:** added the token-owned `--color-media-border` 15% on-media derivation and migrated the media-picker badge. The stable harness assertion is the second consumer that justifies promoting the former component-local derivation to a role.
- **I4 / FIX 6 — stale UX guidance:** rolled `docs/ux-decisions.md` forward from deleted `--shadow-dropdown`/global ownership language to the composed token directory and surviving `--shadow-md` elevation vocabulary.

Final verification: `bun run --filter @snc/web test` — 195 files / 2,019 tests passed; `bun run --filter @snc/web build` — passed (dependency `use client` warnings only).
