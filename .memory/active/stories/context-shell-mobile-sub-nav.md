---
id: story-context-shell-mobile-sub-nav
kind: story
stage: done
tags: [design-system, ux-polish]
release_binding: 0.3.0
created: 2026-04-20
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: responsive-overhaul
---

# Context-shell mobile sub-navigation

Close the architectural gap surfaced during `responsive-overhaul-implementation` review (2026-04-20). Unit 5 correctly hides the `context-shell` sidebar at `<768px` per spec, but sections that use `ContextShell` as their primary sub-navigation then have no mobile entry point to navigate between sub-pages. The sidebar reappears in landscape at `≥768px`, but portrait mobile users can reach the section's top route and nothing else.

Blocks the `responsive-overhaul` epic from flipping to done. Must ship in 0.3.0 — all three `ContextShell` consumers are reachable during the April 24 event.

## Scope — one file, three shells

Three shells currently use `ContextShell` (verified during design pass 2026-04-20):

- [routes/admin.tsx](../../apps/web/src/routes/admin.tsx) — admin sub-routes (creators, playout, simulcast, etc.)
- [routes/governance.tsx](../../apps/web/src/routes/governance.tsx) — governance sub-routes
- [routes/creators/$creatorId/manage.tsx](../../apps/web/src/routes/creators/$creatorId/manage.tsx) — creator manage sub-routes (content, projects, settings, pending-bookings)

`ContextShell` at [components/layout/context-shell.tsx](../../apps/web/src/components/layout/context-shell.tsx) already owns the full nav config + item rendering + active-state logic. The fix is a **single-file change**: add a mobile-only horizontal chip bar rendering of the same items inside `ContextShell`, visible below `768px`, hidden at `≥768px`. All three shells inherit automatically — no per-consumer wiring, no new shared primitive.

## Design

### TSX change — [context-shell.tsx](../../apps/web/src/components/layout/context-shell.tsx)

Inside the existing component, add a `<nav>` element between the closing `</aside>` and the opening `<div className={styles.content}>`. Same `config.items.map(...)` body, same feature-flag + `itemFilter` filtering, same active-state computation, same `<Link>` component. Different wrapper className (`styles.chipBar` instead of `styles.nav`) and different item className (`styles.chip` / `styles.chipActive`).

Extract the per-item filter + active-state logic into a private helper inside the component file to avoid duplicating the conditional logic:

```typescript
// private helper
interface RenderedItem {
  readonly item: ContextNavItem;
  readonly itemPath: string;
  readonly isActive: boolean;
}

function useRenderedItems(
  config: ContextNavConfig,
  itemFilter: ((item: ContextNavItem) => boolean) | undefined,
  currentPath: string,
): readonly RenderedItem[] {
  return config.items
    .filter((item) => !item.featureFlag || isFeatureEnabled(item.featureFlag))
    .filter((item) => !itemFilter || itemFilter(item))
    .map((item) => {
      const itemPath = `${config.basePath}${item.to}`;
      const isActive =
        item.to === ""
          ? currentPath === config.basePath || currentPath === `${config.basePath}/`
          : currentPath.startsWith(itemPath);
      return { item, itemPath, isActive };
    });
}
```

The sidebar `<nav>` maps over `renderedItems` with sidebar styles; the new chip bar `<nav>` maps over the same list with chip styles. No behavioral drift between the two surfaces possible.

### CSS change — [context-shell.module.css](../../apps/web/src/components/layout/context-shell.module.css)

Add `.chipBar`, `.chip`, `.chipActive` rules at the base (mobile-first):

- `.chipBar` — sticky below the top nav bar (`position: sticky; top: var(--nav-height); z-index` appropriate to not overlap modals), full-width bar with `display: flex; overflow-x: auto; -webkit-overflow-scrolling: touch; scroll-snap-type: x mandatory;`, bottom border matching sidebar visual weight, background `var(--color-bg)` to break from content below.
- `.chip` — inline-flex, whitespace-nowrap, `scroll-snap-align: start`, same muted text color as `.navItem`, padding matching existing chip patterns in the codebase (`var(--space-xs) var(--space-md)`).
- `.chipActive` — accent color + accent-bg, matching existing active-state visual language from `.navItemActive`.

At `@media (min-width: 768px)`, `.chipBar { display: none; }` — sidebar takes over.

Hide scrollbar for cleaner look (`::-webkit-scrollbar { display: none; }` + `scrollbar-width: none;`).

### Active-chip scroll-into-view

On route change where the active chip is outside the visible scroll area (e.g., navigating from `/admin/creators` to `/admin/simulcast` on mobile), ensure the new active chip scrolls into view. Use a `useEffect` in `ContextShell` keyed on `currentPath`:

```typescript
const chipBarRef = useRef<HTMLElement | null>(null);
useEffect(() => {
  const active = chipBarRef.current?.querySelector(`.${styles.chipActive}`);
  if (active instanceof HTMLElement) {
    active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }
}, [currentPath]);
```

This is additive — if `chipBarRef` isn't mounted (desktop), the query returns null and nothing happens.

### A11y

- `aria-label` on the chip `<nav>` distinct from the sidebar's to avoid duplicate-landmark AT announcement confusion. Use `${config.label} mobile navigation`.
- `aria-current="page"` on the active chip (matching an assumption to also add it to the sidebar active `.navItem` for consistency — small concurrent fix worth including).
- Keyboard nav: each chip is a `<Link>` (tabbable by default); active state is visually distinct and announced via `aria-current`.

## Tasks

- [x] **Extract `useRenderedItems` helper** in [context-shell.tsx](../../apps/web/src/components/layout/context-shell.tsx) to dedupe the filter+active-state logic. Existing sidebar `<nav>` uses the new helper's output.
- [x] **Add mobile chip bar `<nav>`** inside `ContextShell`, after the sidebar `<aside>`, before the content `<div>`. Map over `renderedItems` with `styles.chip` / `styles.chipActive` classes. `aria-label="{config.label} mobile navigation"`.
- [x] **Add `aria-current="page"`** to active sidebar items + active chip items.
- [x] **Add chip-bar CSS** in [context-shell.module.css](../../apps/web/src/components/layout/context-shell.module.css) — sticky below nav, horizontal scroll with snap, hidden at `≥768px`, no scrollbar visible.
- [x] **Scroll-active-chip-into-view** effect keyed on `currentPath`.
- [x] **Unit test**: [apps/web/tests/unit/components/layout/context-shell.test.tsx](../../apps/web/tests/unit/components/layout/context-shell.test.tsx) — renders chip bar with correct items, active chip highlighted, honors `itemFilter` and `featureFlag` filters identically between sidebar and chip bar.

## Acceptance Criteria

- [x] Admin `/admin/*` routes show a horizontal scrollable chip bar on mobile listing all sub-routes; active chip highlights matching route; chip bar hidden at `≥768px`.
- [x] Governance `/governance/*` routes inherit the same treatment — no per-consumer code changes.
- [x] Creator Manage `/creators/$creatorId/manage/*` routes inherit the same treatment — no per-consumer code changes.
- [x] Chip bar sticks below the top nav bar (doesn't scroll off as the page body scrolls).
- [x] Horizontal scroll works on touch devices; scroll-snap keeps chips aligned.
- [x] Active chip scrolls into view on navigation when previously off-screen.
- [x] `itemFilter` and feature flag filters apply identically to sidebar and chip bar (no behavioral drift between surfaces — single source rendered twice).
- [x] `aria-current="page"` on active items in both surfaces.
- [x] Zero visual regression on desktop (sidebar unchanged at `≥768px`).
- [x] Unit test passes; `bun run --filter @snc/web test` green.
- [x] `bun run --filter @snc/web build` green.

## Implementation Outcome (2026-04-20)

Landed per spec. Single Sonnet agent, no deviations from design.

- [context-shell.tsx](../../apps/web/src/components/layout/context-shell.tsx): extracted `useRenderedItems` helper (single source of truth for filter + active-state), added mobile chip-bar `<nav>` between sidebar and content with distinct `aria-label`, added `aria-current="page"` on active items in both surfaces, scroll-active-chip-into-view effect keyed on `currentPath`.
- [context-shell.module.css](../../apps/web/src/components/layout/context-shell.module.css): `.chipBar` / `.chip` / `.chipActive` at base (mobile-first), sticky below nav via `var(--nav-height)` + `var(--z-sticky)`, horizontal scroll with `scroll-snap-type: x mandatory`, scrollbars hidden, `display: none` at `≥768px`.
- [tests/unit/components/layout/context-shell.test.tsx](../../apps/web/tests/unit/components/layout/context-shell.test.tsx): 13 new test cases across 5 describe groups — both-surfaces render identical items, active state (sidebar + chip bar), `itemFilter` hides from both surfaces, `featureFlag` gating hides from both surfaces, distinct aria-labels.

**Codebase-compat note:** `scrollIntoView` is not implemented in jsdom. Followed the existing codebase pattern (`chat-panel.test.tsx`, `live.test.tsx`) of stubbing `window.HTMLElement.prototype.scrollIntoView = vi.fn()` at the top of the test file. Component code itself unchanged from design.

**Verification:** `bun --filter @snc/web test` 1541/1541 green (1528 existing + 13 new), `build` clean.

## Review Outcome (2026-04-20)

**Signed off. Bound to 0.3.0.**

User-verified on mobile across all three ContextShell consumers: admin, governance, creator-manage. Chip bar sticks flush under the top nav from the very first paint, spans full viewport width, scroll-snaps horizontally, hides at `≥768px`.

**Fixes in-flight during this review (all user-re-verified):**

- **Chip bar had visible top gap that scrolled away** — chip bar's natural position sat inside `.main-content`'s `padding-top` (`var(--space-section-fluid)`), so on initial paint a gap was visible until sticky kicked in. Added negative margins on [context-shell.module.css](../../apps/web/src/components/layout/context-shell.module.css) `.chipBar` to cancel main-content's top + horizontal padding, with horizontal padding restored inside the chip bar. Chip bar now sits flush under the nav from load and is edge-to-edge.
- **User-menu dropdown rendered behind the chip bar** — chip bar's `z-index: var(--z-sticky)` (200) won against Ark-UI Menu positioner's nominal `z-index: var(--z-dropdown)` (100). Two-part fix:
  - Lowered chip bar to `z-index: var(--z-raised)` (10) — below any dropdown.
  - Discovered Ark-UI's Menu positioner applies its own inline `style="z-index: var(--z-index); --z-index: auto;"`, which beat our class-based rule in the cascade (inline > class). Added `z-index: var(--z-dropdown) !important` on [`.positioner` in menu.module.css](../../apps/web/src/components/ui/menu.module.css) to supersede the inline declaration. `!important` is justified here as the only cascade-level way to override third-party inline styles; follow-up backlog item scoped to find a cleaner approach (`ark-ui-menu-z-index-override`).

**Deferred to backlog:**

- `calendar-page-mobile-responsive` — `.navRow` / `.filterRow` in [calendar.module.css](../../apps/web/src/routes/calendar.module.css) don't wrap at mobile; Prev/Next buttons fall off the viewport and the page forces horizontal scroll. Unrelated to chip bar; resurfaced during this review because the horizontal page scroll made the sticky chip bar on `/governance/calendar` appear to "fall off horizontally" — a side-effect that resolves once the page itself stops overflowing. Not in responsive-overhaul's original Unit 7 sweep.
- `ark-ui-menu-z-index-override` — the `!important` override above is a code smell. Investigate a cleaner approach (Ark-UI prop, CSS layers, forward style, upstream fix) that preserves correct z-stacking without the escape hatch. Applies to all Ark-UI positioners, not just Menu.
- `user-menu-dropdown-position-polish` — unrelated UX polish observation surfaced during F3 verification: the user-menu dropdown visually detaches from the MC avatar trigger on mobile (floats leftward). Tune `gutter`/`offset` on MenuRoot positioning, or add a caret/arrow to visually re-anchor.

**Verification:** 1541/1541 web tests green across all iterations; `build` clean.
