---
id: epic-responsive-overhaul
kind: epic
stage: review
tags: [design-system, ux-polish]
release_binding: null
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Responsive Overhaul

Mobile-first rewrite of the platform's CSS layer. Breakpoint tokens, fluid typography/spacing completion, desktop-first → mobile-first sweep across 18 module.css files, container queries for reusable components, and event-form responsive collapse.

Reference: `platform/.memory/research/responsive-design-best-practices.md`, `platform/.memory/research/ui-ux-system-plan.md § Phase 3`.

---

## Scoping Brief

### Current State Audit

#### Media queries: 29 total across 21 files

| Direction | Count | Files |
|-----------|-------|-------|
| `max-width` (desktop-first) | 24 | 18 files |
| `min-width` (mobile-first) | 3 | 2 files (`global.css`, `product-detail.module.css`) |
| `prefers-reduced-motion` | 2 | 2 files |

**83% desktop-first.** Only the `content-grid` global utility and merch product detail are mobile-first.

#### Breakpoint values: two, inconsistent

| Value | Usage | Direction |
|-------|-------|-----------|
| `768px` | 10 occurrences | `max-width` |
| `767px` | 12 occurrences | `max-width` |
| `1024px` | 2 occurrences | `min-width` (global.css only) |

The 767px/768px split is a classic off-by-one: `max-width: 768px` catches the iPad portrait breakpoint itself, `max-width: 767px` excludes it. No consistent convention — each file picked one. No breakpoint tokens exist.

#### Container queries: zero

No `@container` usage. No `container-type` declarations.

#### Fluid typography: minimal

Two tokens defined in `tokens/typography.css`:
- `--font-size-3xl-fluid: clamp(1.75rem, 1rem + 2vw, 2.5rem)`
- `--font-size-2xl-fluid: clamp(1.35rem, 0.9rem + 1.5vw, 1.75rem)`

Not applied anywhere by default — `global.css` heading rules use the fixed `--font-size-3xl`/`--font-size-2xl` tokens. Fluid tokens exist but are opt-in per-component.

#### Fluid spacing: none

No `clamp()` on spacing properties. All spacing via fixed `--space-*` tokens.

#### Intrinsic responsive grids (good pattern, already present)

4 files use `auto-fit, minmax()`:
- `pricing.module.css` — `repeat(auto-fit, minmax(260px, 1fr))`
- `studio-service-section.module.css` — `repeat(auto-fit, minmax(200px, 1fr))`
- `studio-equipment.module.css` — `repeat(auto-fit, minmax(200px, 1fr))`
- `landing-pricing.module.css` — `repeat(auto-fit, minmax(260px, 1fr))`

These need no responsive rewrite — they already adapt intrinsically.

#### Fixed grids needing responsive strategy

| File | Grid | Current responsive |
|------|------|--------------------|
| `__root.module.css` | `1fr 340px` (live grid) | Stacks `<768px` via flex fallback |
| `event-form.module.css` | `3fr 2fr 3fr 2fr` / `3fr 2fr` / `1fr 1fr` | No mobile collapse at all |
| `calendar-grid.module.css` | `repeat(7, 1fr)` | None (appropriate — week grid) |

#### Per-file media query inventory

**Layout shell:**
- `nav-bar.module.css` — hides desktop nav items `<767px`
- `mobile-menu.module.css` — shows hamburger sheet `<767px` *(deferred to 0.2.7 nav redesign)*
- `user-menu.module.css` — hides user menu `<767px`
- `context-shell.module.css` — adjusts shell layout `<768px`
- `global-player.module.css` — simplifies player chrome `<768px`

**Pages:**
- `__root.module.css` — live grid stacks `<768px`
- `live.module.css` — live page adjusts `<768px`
- `dashboard.module.css` — dashboard layout `<767px`
- `admin-creators.module.css` — admin table responsive `<768px`
- `emissions.module.css` — emissions page `<767px`
- `content-manage.module.css` — content management `<768px`

**Components:**
- `hero-section.module.css` — landing hero `<767px`
- `pending-bookings-table.module.css` — table→cards `<767px`
- `audio-detail.module.css` — 3 queries, all `<767px`
- `audio-detail-view.module.css` — 3 queries, all `<767px`
- `audio-locked-view.module.css` — 3 queries, all `<767px`
- `studio-hero.module.css` — studio hero `<767px`
- `studio-service-section.module.css` — service grid `<767px`
- `product-detail.module.css` — merch detail, mobile-first `min-width: 768px`

---

## Architectural Decisions

### 1. Breakpoint token approach

**Decision: hard-code literals + document in one token file.** The simpler path.

CSS custom properties can't be used in `@media` conditions. The alternatives:
- `postcss-custom-media` via Vite plugin — adds a build dependency for cosmetic benefit
- `@custom-media` (CSS spec) — no browser support yet
- Sass variables — we don't use Sass

Recommended approach: define breakpoint values as comments in a new `tokens/breakpoints.css` file that serves as the single source of truth. All media queries reference these values by convention, enforced by a scan rule.

```css
/* tokens/breakpoints.css — reference only, not usable in @media */
/* Breakpoints:
   --bp-sm: 640px   (small phones → large phones)
   --bp-md: 768px   (phones → tablets)
   --bp-lg: 1024px  (tablets → desktop)
*/
```

Three breakpoints: sm (640), md (768), lg (1024). The 767px/768px inconsistency resolves to `min-width: 768px` everywhere (mobile-first).

### 2. Intrinsic grid vs container query decision rule

- **Intrinsic grid** (`auto-fit, minmax()`) when items are uniform and just need to reflow. Already used in pricing/studio grids — extend this pattern.
- **Container query** when the same component renders at different container widths and needs to change its *internal* layout (not just reflow). Candidates: content cards in feed vs sidebar vs landing, global player mini vs full, pending-bookings table.
- Don't use CQs as a fancier media query. If the component only lives at one container width, `min-width` media query is simpler.

### 3. Two-tier spacing tokens

Add fluid variants alongside fixed tokens:

```css
--space-section-fluid: clamp(var(--space-lg), 2vw + 1rem, var(--space-2xl));
--space-layout-fluid: clamp(var(--space-md), 1.5vw + 0.5rem, var(--space-xl));
```

Use fluid spacing for layout shell (main content padding, section gaps). Keep fixed `--space-*` for component internals (button padding, card gaps).

### 4. Hydration strategy for responsive layout divergence

TanStack Start SSR can't detect viewport. Two patterns:

- **Default (CSS-only):** render one DOM tree, use CSS to show/hide or rearrange. No hydration mismatch. Use this for layout shell, grids, typography.
- **JS-driven (rare):** `useSyncExternalStore` with stable `getServerSnapshot` returning a safe default. Only needed if the *data* differs (e.g., different API payload for mobile). We don't have this case yet.

The "render both, hide one" CSS pattern avoids hydration flashes. The current nav does this — that's the correct pattern.

### 5. Responsive images — deferred

Natural pairing with self-hosted imgproxy in front of Garage. Not part of the CSS sweep — separate implementation unit.

---

## Container Query Candidates

Ranked by impact:

1. **Content cards / feed rows** — rendered in feed, creator detail, landing featured, dashboard. Same component, 3+ container widths. Biggest CQ win.
2. **Pending bookings table** — desktop table vs mobile stacked cards. Self-contained, one consumer, but complex layout shift.
3. **Global player** — mini (bottom bar) vs expanded. Already has `<768px` media query; CQ would decouple from viewport. *Verdict: keep as media query — `position: fixed` is inherently viewport-relative.*
4. **Creator cards** — used in creators list + landing. Simpler component, `auto-fit minmax()` may suffice.

### CQ implementation pattern for CSS Modules

```css
/* card.module.css */
.cardContainer {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .card {
    flex-direction: row;
  }
}
```

No SSR concerns — `container-type` is CSS-only, no hydration mismatch. Baseline support: all evergreen browsers since Feb 2023.

---

## Migration Strategy

### Phase ordering

1. **Breakpoint tokens** — add `tokens/breakpoints.css`, define the three values.
2. **Fluid typography completion** — add `--font-size-xl-fluid`, `--font-size-lg-fluid`. Apply fluid variants to global heading rules.
3. **Fluid spacing tokens** — add `--space-section-fluid`, `--space-layout-fluid`. Apply to `.main-content` and layout shell.
4. **Global utilities** — rewrite `.content-grid` and `.main-content` mobile-first. Already partially mobile-first.
5. **Layout shell** — `context-shell`, `nav-bar`, `global-player`. Mobile-first rewrite.
6. **Container query migration** — content cards, pending-bookings-table.
7. **Page-level passes** — each page gets a mobile-first rewrite. Order by traffic/importance: live → dashboard → creator detail → admin → emissions → content management.
8. **Event form responsive** — calendar domain pull-in. Add mobile collapse for the `3fr 2fr 3fr 2fr` grid.

### Mechanical sweep: max-width → min-width

Each file conversion follows the same pattern:
1. Identify the desktop styles (currently outside the media query)
2. Move them inside `@media (min-width: 768px)` (or appropriate breakpoint)
3. Identify the mobile styles (currently inside `@media (max-width: ...)`)
4. Move them to the base (outside any media query)
5. Verify with Playwright viewport tests

This is safe to batch by file. Each file is self-contained (CSS Modules scope prevents cross-file interference).

---

## Scope Boundary

**In scope:**
- Breakpoint tokens (documented values, scan rule)
- Fluid typography completion (xl, lg tokens + global heading application)
- Fluid spacing tokens (section-level)
- Desktop-first → mobile-first sweep (all 18 files)
- Container queries for content cards, bookings table, global player
- Page-level responsive passes (all non-nav pages)
- Event form responsive collapse (pulled from calendar domain)

**Deferred to later in 0.2.7 (blocked on 0.2.6 Review):**
- Mobile nav redesign (bottom tab bar, retire mobile-menu/useMenuToggle/useDismiss)

**Deferred to separate release/design:**
- Responsive images + image CDN (imgproxy in front of Garage)
- Feed page UX redesign (needs its own scoping — masonry/content-type sections)
