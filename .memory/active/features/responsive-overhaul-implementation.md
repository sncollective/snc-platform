---
id: feature-responsive-overhaul-implementation
kind: feature
stage: done
tags: [design-system, ux-polish]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: responsive-overhaul
---

# Responsive Overhaul — Implementation

## Tasks

- [x] **Breakpoint tokens** — Unit 1: `tokens/breakpoints.css` + import in `global.css`
- [x] **Fluid typography completion** — Unit 2: `--font-size-xl-fluid`, `--font-size-lg-fluid` + global heading rules
- [x] **Fluid spacing tokens** — Unit 3: `--space-section-fluid`, `--space-layout-fluid` + `.main-content`
- [x] **Global utilities** — Unit 4: confirmed `.content-grid` already correct
- [x] **Layout shell** — Unit 5: `context-shell`, `nav-bar`, `global-player`
- [x] **User menu** — Unit 9: mobile-first rewrite
- [x] **Live page** — Unit 6: `__root.module.css` + `live.module.css`
- [x] **Page-level passes** — Unit 7: dashboard, emissions, admin-creators, content-manage, pending-bookings-table (hero-section skipped — absorbed into landing page redesign)
- [x] **Component passes** — Unit 8: studio-hero, studio-service-section, audio-detail ×3
- [x] **Pending bookings table CQ** — Unit 10: `@container dashboard` on bookings table
- [x] **Main content container** — Unit 11: `container-type: inline-size` on `.main-content` (global player stays `@media`)
- [x] **Event form responsive** — Unit 12: date row grid mobile collapse
- [x] **Mobile viewport e2e project** — `Pixel 7` project in `playwright.config.ts`
- [x] **Horizontal scroll guard** — `responsive/no-horizontal-scroll.spec.ts`

---

## Overview

Mobile-first rewrite of the platform's CSS layer: breakpoint tokens, fluid typography/spacing completion, desktop-first → mobile-first sweep across 18 module.css files, container queries for reusable components, and event-form responsive collapse.

No React component changes — this is a pure CSS design. Every unit modifies `.css` files only. The existing "render both, hide one" DOM pattern for nav (desktop links + mobile menu) stays unchanged.

---

## Implementation Units

### Unit 1: Breakpoint Tokens

**File**: `apps/web/src/styles/tokens/breakpoints.css` *(new)*

```css
/*
 * ── Breakpoint Reference Tokens ──
 *
 * CSS custom properties cannot appear in @media conditions.
 * This file is the single source of truth — all media queries
 * reference these values by convention.
 *
 * Mobile-first: use min-width exclusively.
 *
 *   @media (min-width: 640px)  → sm: large phones / small tablets
 *   @media (min-width: 768px)  → md: tablets / small laptops
 *   @media (min-width: 1024px) → lg: desktops
 *
 * Scan rule `breakpoint-literal` enforces these values.
 */
```

**File**: `apps/web/src/styles/global.css` — add import

```css
@import "./tokens/breakpoints.css";
```

Add after the existing `@import "./tokens/radius.css";` line.

**Acceptance Criteria**:

- [x] `tokens/breakpoints.css` exists with documented sm/md/lg values
- [x] `global.css` imports it
- [x] No `:root` declarations in the file (comment-only)

---

### Unit 2: Fluid Typography Completion

**File**: `apps/web/src/styles/tokens/typography.css`

Add two new fluid tokens after the existing `--font-size-2xl-fluid`:

```css
  /* Fluid typography — headings scale with viewport */
  --font-size-3xl-fluid: clamp(1.75rem, 1rem + 2vw, 2.5rem);
  --font-size-2xl-fluid: clamp(1.35rem, 0.9rem + 1.5vw, 1.75rem);
  --font-size-xl-fluid: clamp(1.125rem, 0.85rem + 0.75vw, 1.375rem);
  --font-size-lg-fluid: clamp(1rem, 0.9rem + 0.5vw, 1.175rem);
```

**File**: `apps/web/src/styles/global.css` — apply fluid tokens to heading rules

```css
/* After */
h1 {
  font-size: var(--font-size-3xl-fluid);
}

h2 {
  font-size: var(--font-size-2xl-fluid);
}

h3 {
  font-size: var(--font-size-xl-fluid);
}
```

**Acceptance Criteria**:

- [x] `--font-size-xl-fluid` and `--font-size-lg-fluid` tokens defined
- [x] `h1`/`h2`/`h3` global rules use fluid tokens
- [x] Text remains readable at 200% browser zoom (min values ≥1rem)

---

### Unit 3: Fluid Spacing Tokens

**File**: `apps/web/src/styles/tokens/spacing.css`

Add fluid spacing tokens after the existing scale:

```css
  /* Fluid layout spacing — scales with viewport */
  --space-section-fluid: clamp(1.5rem, 1rem + 2vw, 3rem);    /* --space-lg → --space-2xl */
  --space-layout-fluid: clamp(1rem, 0.5rem + 1.5vw, 2rem);   /* --space-md → --space-xl */
```

**File**: `apps/web/src/styles/global.css` — apply to `.main-content`

```css
/* After */
.main-content {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-section-fluid) var(--space-layout-fluid);
  padding-bottom: calc(var(--space-section-fluid) + var(--mini-player-height) + var(--mini-upload-height));
  min-height: calc(100vh - var(--nav-height) - 120px);
}
```

**Acceptance Criteria**:

- [x] `--space-section-fluid` and `--space-layout-fluid` tokens defined
- [x] `.main-content` uses fluid spacing tokens
- [x] No change to fixed spacing scale

---

### Unit 4: Global Utilities — Mobile-First Rewrite

**File**: `apps/web/src/styles/global.css`

No changes required — `.content-grid` already uses `min-width` with the exact breakpoint values from the token file. `.main-content` is handled in Unit 3.

**Acceptance Criteria**:

- [x] `.content-grid` confirmed as mobile-first with md/lg breakpoints (no edit needed)

---

### Unit 5: Layout Shell — Mobile-First Rewrite

Three files, each following the mechanical sweep pattern: move current mobile (`max-width`) styles to base, wrap current base styles in `@media (min-width: 768px)`.

**File**: `apps/web/src/components/layout/context-shell.module.css`

```css
/* ── After: mobile-first ── */

.shell {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - var(--nav-height));
}

.sidebar {
  display: none;
}

.content {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  padding: var(--space-lg) var(--space-md);
}

@media (min-width: 768px) {
  .shell {
    flex-direction: row;
  }

  .sidebar {
    width: var(--sidebar-width);
    flex-shrink: 0;
    border-right: 1px solid var(--color-border);
    background: var(--color-bg);
    padding: var(--space-md) 0;
    display: flex;
    flex-direction: column;
    position: sticky;
    top: var(--nav-height);
    height: calc(100vh - var(--nav-height));
    overflow-y: auto;
  }

  .content {
    max-width: var(--content-max-width);
  }
}
```

**File**: `apps/web/src/components/layout/nav-bar.module.css`

```css
/* After */
.links {
  display: none;
  gap: var(--space-lg);
  list-style: none;
}

@media (min-width: 768px) {
  .links {
    display: flex;
  }
}
```

**File**: `apps/web/src/components/media/global-player.module.css`

```css
/* After — mobile-first */
.collapsedOverlay {
  position: fixed;
  bottom: calc(var(--space-md) + var(--mini-upload-height, 0px));
  right: var(--space-md);
  width: 200px;
  aspect-ratio: 16 / 9;
  z-index: 200;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-border);
  background: var(--color-media-bg);
}

@media (min-width: 768px) {
  .collapsedOverlay {
    width: 320px;
    bottom: calc(var(--space-lg) + var(--mini-upload-height, 0px));
    right: var(--space-lg);
  }
}
```

**Acceptance Criteria**:

- [x] `context-shell.module.css` — base styles are mobile, sidebar shows at md+
- [x] `nav-bar.module.css` — `.links` hidden by default, shown at md+
- [x] `global-player.module.css` — `.collapsedOverlay` starts at 200px, scales to 320px at md+
- [x] No `max-width` media queries remain in these three files

---

### Unit 6: Live Page — Mobile-First Rewrite

**File**: `apps/web/src/routes/__root.module.css`

```css
/* After — mobile-first */

.liveGrid {
  display: flex;
  flex-direction: column;
  height: auto;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-lg) var(--space-md);
  overflow: visible;
  min-height: 0;
}

.chatPortal {
  border-left: none;
  border-top: 1px solid var(--color-border);
  height: 400px;
  overflow: hidden;
}

@media (min-width: 768px) {
  .liveGrid {
    display: grid;
    grid-template-columns: 1fr 340px;
    grid-template-rows: auto 1fr;
    height: calc(100vh - var(--nav-height));
    max-width: none;
    padding: 0 0 0 var(--space-xl);
    margin: 0;
    overflow: hidden;
  }

  .chatPortal {
    grid-column: 2;
    grid-row: 1 / -1;
    border-left: 1px solid var(--color-border);
    border-top: none;
    height: auto;
  }
}
```

**File**: `apps/web/src/routes/live.module.css`

```css
/* After — mobile-first */
.theaterToggle {
  display: none;
  /* ... rest of base styles unchanged ... */
}

.chatExpandTab {
  display: none;
  /* ... rest of base styles unchanged ... */
}

@media (min-width: 768px) {
  .theaterToggle {
    display: flex;
  }

  .chatExpandTab {
    display: flex;
  }
}
```

**Acceptance Criteria**:

- [x] `__root.module.css` — liveGrid is flex-column by default, grid at md+
- [x] `live.module.css` — theater/chat controls hidden by default, shown at md+
- [x] No `max-width` media queries remain in either file

---

### Unit 7: Page-Level Responsive Passes

Six files, each a mechanical `max-width` → `min-width` inversion.

**File**: `apps/web/src/routes/dashboard.module.css`

```css
/* After — mobile-first */
.kpiRow {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

@media (min-width: 768px) {
  .kpiRow {
    flex-direction: row;
  }
}
```

**File**: `apps/web/src/routes/emissions.module.css`

```css
/* After — mobile-first */
.kpiRow {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

@media (min-width: 768px) {
  .kpiRow {
    flex-direction: row;
  }
}
```

**File**: `apps/web/src/routes/admin/admin-creators.module.css`

```css
/* After — mobile-first */
.table {
  width: 100%;
  border-collapse: collapse;
  display: block;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

@media (min-width: 768px) {
  .table {
    display: table;
    overflow-x: visible;
  }
}
```

**File**: `apps/web/src/routes/creators/$creatorId/manage/content-manage.module.css`

```css
/* After — mobile-first */
.editColumns {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  align-items: flex-start;
}

@media (min-width: 768px) {
  .editColumns {
    flex-direction: row;
  }
}
```

**File**: `apps/web/src/components/landing/hero-section.module.css` — **SKIPPED** (absorbed into landing page redesign)

**File**: `apps/web/src/components/dashboard/pending-bookings-table.module.css`

```css
/* After — mobile-first */
.table {
  width: 100%;
  border-collapse: collapse;
  display: none;
}

.cardList {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

@media (min-width: 768px) {
  .table {
    display: table;
  }

  .cardList {
    display: none;
  }
}
```

**Acceptance Criteria**:

- [x] All six files use `min-width: 768px` exclusively
- [x] No `max-width` media queries remain
- [x] Mobile styles are base, desktop styles are inside `@media`
- [x] Hero heading uses `--font-size-3xl-fluid` instead of hardcoded sizes

---

### Unit 8: Component Responsive Passes

Five more files with the same mechanical inversion.

**File**: `apps/web/src/components/studio/studio-hero.module.css`

```css
/* After — mobile-first */
.hero {
  background: linear-gradient(180deg, var(--color-bg) 0%, var(--color-bg-hero-gradient) 100%);
  padding: var(--space-xl) var(--space-md);
  text-align: center;
  animation: fadeIn 0.3s ease-out both;
  border-radius: var(--radius-lg);
}

.heading {
  font-family: var(--font-heading);
  font-size: var(--font-size-3xl-fluid);
  line-height: 1.2;
  margin: 0 0 var(--space-md);
}

.subheading {
  font-family: var(--font-ui);
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.6;
}

@media (min-width: 768px) {
  .hero {
    padding: var(--space-2xl) var(--space-md);
  }

  .subheading {
    font-size: var(--font-size-lg);
  }
}
```

**File**: `apps/web/src/components/studio/studio-service-section.module.css`

```css
/* After — mobile-first */
.features {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-lg);
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-sm);
}

@media (min-width: 768px) {
  .features {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}
```

**Files**: `audio-detail.module.css`, `audio-detail-view.module.css`, `audio-locked-view.module.css` — same pattern for each:

```css
/* After — mobile-first */
.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xl);
}

.coverArt {
  width: 240px;
  height: 240px;
  object-fit: cover;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

@media (min-width: 768px) {
  .header {
    flex-direction: row;
    align-items: flex-start;
  }

  .coverArt {
    width: 280px;
    height: 280px;
  }
}
```

**Acceptance Criteria**:

- [x] All five files use `min-width: 768px` exclusively
- [x] Hero components use `--font-size-3xl-fluid` for headings
- [x] Audio detail components: 3 queries → 1 consolidated query per file
- [x] No `max-width` media queries remain

---

### Unit 9: User Menu — Mobile-First

**File**: `apps/web/src/components/layout/user-menu.module.css`

```css
/* After — mobile-first */
.avatarButton {
  display: none;
  /* ... rest of styles ... */
}

.avatarSkeleton {
  display: none;
  /* ... rest of styles ... */
}

.loggedOut {
  display: none;
  /* ... rest of styles ... */
}

@media (min-width: 768px) {
  .avatarButton {
    display: flex;
  }

  .avatarSkeleton {
    display: block;
  }

  .loggedOut {
    display: flex;
  }
}
```

`mobile-menu.module.css` is explicitly **not touched** — deferred to the `mobile-nav-redesign` epic. Its `max-width: 767px` query stays as-is until the whole component is deleted.

**Acceptance Criteria**:

- [x] User menu elements hidden by default, shown at md+
- [x] `mobile-menu.module.css` unchanged
- [x] No `max-width` media queries remain in `user-menu.module.css`

---

### Unit 10: Container Query — Pending Bookings Table

**File**: `apps/web/src/routes/dashboard.module.css`

```css
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
  container-type: inline-size;
  container-name: dashboard;
}
```

**File**: `apps/web/src/components/dashboard/pending-bookings-table.module.css`

```css
/* Base: card layout (mobile) */
.table {
  width: 100%;
  border-collapse: collapse;
  display: none;
}

.cardList {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

/* Container query: table layout when parent is wide enough */
@container dashboard (min-width: 640px) {
  .table {
    display: table;
  }

  .cardList {
    display: none;
  }
}
```

Breakpoint is 640px (sm) not 768px — the table layout works in narrower containers than the full viewport md breakpoint, because the dashboard content area is already inset by sidebar + padding.

**Acceptance Criteria**:

- [x] Dashboard page has `container-type: inline-size`
- [x] Bookings table switches layout via `@container` not `@media`
- [x] Table shows when container ≥640px, cards when narrower

---

### Unit 11: Container Query — Global Player (no CQ needed)

**File**: `apps/web/src/styles/global.css`

```css
.main-content {
  /* ... existing styles ... */
  container-type: inline-size;
  container-name: main-content;
}
```

The `.collapsedOverlay` is `position: fixed` — positioned relative to the viewport, not its container. Container queries wouldn't help here. **Keep this as a media query** — the Unit 5 mobile-first rewrite is sufficient. The `container-type` addition to `.main-content` is still useful for other CQ consumers.

**Acceptance Criteria**:

- [x] Global player stays with `@media` query (not CQ) — documented decision
- [x] `container-type: inline-size` added to `.main-content` (still useful for other CQ consumers)

---

### Unit 12: Event Form Responsive Collapse

**File**: `apps/web/src/components/calendar/event-form.module.css`

```css
/* After — mobile-first */
.dateRow {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
}

.dateRowWithTime {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
}

.dateRowStartOnly {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
}

@media (min-width: 768px) {
  .dateRow {
    grid-template-columns: 1fr 1fr;
  }

  .dateRowWithTime {
    grid-template-columns: 3fr 2fr 3fr 2fr;
  }

  .dateRowStartOnly {
    grid-template-columns: 3fr 2fr;
  }
}
```

**Acceptance Criteria**:

- [x] All three date row variants stack to single column on mobile
- [x] Desktop layout restored at md+ with original proportions
- [x] Form remains usable at 320px viewport width

---

## Implementation Order

1. Unit 1: Breakpoint tokens — foundation reference, no functional change
2. Unit 2: Fluid typography — new tokens + global heading rules
3. Unit 3: Fluid spacing — new tokens + `.main-content` application
4. Unit 4: Global utilities — confirm no changes needed
5. Unit 5: Layout shell — context-shell, nav-bar, global-player
6. Unit 9: User menu — nav-adjacent, independent
7. Unit 6: Live page — `__root.module.css` + `live.module.css`
8. Unit 7: Page-level passes — dashboard, emissions, admin, content-manage, hero, bookings
9. Unit 8: Component passes — studio-hero, studio-service, audio-detail ×3
10. Unit 10: CQ bookings table — builds on Unit 7's mobile-first base
11. Unit 11: CQ global player — no CQ needed, add `container-type` to `.main-content`
12. Unit 12: Event form — independent, can be done anytime after Unit 1

**Parallelization**: Units 5–9 are independent (different files, CSS Modules scoping) and can be implemented in parallel. Units 10–12 are independent of each other.

---

## Verification Checklist

```bash
# Build succeeds (no CSS syntax errors)
bun run --filter @snc/web build

# Run existing tests (no regressions)
bun run --filter @snc/web test

# Run e2e tests at desktop viewport
bun run --filter @snc/e2e test

# Run e2e tests at mobile viewport (after adding mobile project)
bun run --filter @snc/e2e test --project=mobile

# Grep for remaining max-width queries (should only be mobile-menu.module.css)
grep -r "max-width" platform/apps/web/src --include="*.css" --include="*.module.css"
```

Expected: only `mobile-menu.module.css` retains `max-width` (deferred to nav redesign).

---

## Review Outcome (2026-04-20)

**Signed off. Bound to 0.3.0.**

All 14 tasks verified as shipped-as-designed:

- Breakpoint tokens (`tokens/breakpoints.css` + import in `global.css`)
- Fluid typography + spacing tokens (`--font-size-xl-fluid`, `--font-size-lg-fluid`, `--space-section-fluid`, `--space-layout-fluid`)
- Zero `@media (max-width: …)` queries remain in `apps/web/src` — stronger than the spec, which expected `mobile-menu.module.css` to retain its query; the whole file was deleted by `mobile-nav-redesign-implementation` earlier this session
- Container queries landed on dashboard + pending-bookings-table (`@container dashboard`) and `.main-content` (`container-name: main-content`)
- Event-form Unit 12 date-row variants stack at base, restore grid at md+
- Mobile e2e: `mobile` project (Pixel 7) added to `apps/e2e/playwright.config.ts`; `tests/responsive/no-horizontal-scroll.spec.ts` guards `/`, `/live`, `/creators` at 320×568
- Web build clean, 1526/1526 unit tests green

**Fixes in-flight during this review (both user-re-verified before sign-off):**

- **Footer obscured by fixed bottom tab bar on mobile** — `components/layout/footer.module.css` had no bottom spacing to clear the `position: fixed` 56px tab bar (footer lives outside `.main-content`, so the main-content `padding-bottom` calc didn't cover it). Added `padding-bottom: calc(var(--space-lg) + var(--tab-bar-height))`; at md+ `--tab-bar-height` collapses to 0 so desktop unchanged.
- **Creators list-view row squished at mobile** — `components/creator/creator-card.module.css` `.listItem` had fixed `min-width` on name/posts/subscriber/last-post columns totaling ~412px, overflowing past `.listItemLink` at 320px viewport and colliding with the `.manageLink` sibling. Made mobile-first (drop min-widths, `flex: 1` on `.listDisplayName` with ellipsis, hide `.listMeta` columns, restore desktop proportions at `min-width: 768px`). Second pass added `gap: var(--space-md)` to `.listItem` so "N posts" reads clear of the Manage link. First pass closed the overlap; second pass added breathing room — both user-verified.

**Scoped as a new child (blocks epic rollup):**

- `context-shell-mobile-sub-nav` (story, at drafting, bound to 0.3.0, parent: responsive-overhaul) — Admin (`/admin/*`) and Creator Manage (`/creators/$creatorId/manage/*`) use `context-shell` sidebar as their sub-navigation; Unit 5 correctly hides the sidebar at `<768px` per spec, but no mobile entry point was designed for intra-section navigation. Proposed shape: horizontal scrollable chip bar sticky below nav. Must ship in 0.3.0 (both sections are reachable during the April 24 event).

**Parked to backlog:**

- `calendar-month-view-vertical-mobile-polish` — month grid usable at 320px but event chips truncate aggressively; epic brief explicitly parked `calendar-grid.module.css` as out-of-scope for the sweep.
- `creators-list-view-hydration-flash` — `getInitialViewMode()` returns `"grid"` on server, reads localStorage on client; list-preference users see a grid→list flash on hard refresh. Unrelated to the responsive sweep (pre-existing pattern). Cookie-backed preference is the likely fix.

## Meta

First item passed through the new Step 6.5 "verify fix-in-flight" loopback (added to `review/SKILL.md` during this review in response to reviewer critique that visual fixes were being flipped to done without user re-verification). Second pass on F2 caught a missed gap that the first fix didn't close — the loopback did its job.
