# UI/UX System Plan

**Status:** Active reference
**Date:** 2026-04-04

Long-term plan for the S/NC platform's UI/UX system. Covers the current state assessment, recommended architecture, tool choices with justification, and a phased adoption roadmap.

Built for: 1 developer + AI agents now, human designer later.

---

## Current State

### What's working

- **Design tokens** — 40+ CSS custom properties in `global.css`. Colors, typography, spacing, radius, layout. Components reference tokens via `var()` consistently.
- **Form patterns** — shared `form.module.css` (120 lines), Zod validation with `extractFieldErrors()`, consistent field/label/error structure.
- **Layout shell** — nav/sidebar/content. 1200px max-width. Sticky nav. Context-aware sidebar.
- **Color discipline** — almost all colors through tokens. Minimal hardcoded values.
- **Error boundaries** — route-level error boundary with retry/back/home.

### What's missing or weak

- **UI component primitives** — only 2 files in `/components/ui/`. No shared modal, dropdown, tooltip, tabs, popover, toast, badge, or card. Every feature re-implements these ad-hoc, creating inconsistency and accessibility gaps.
- **Responsive design** — desktop-first, only 2 breakpoints (768px, 1024px). No breakpoint tokens. No container queries. Many components have zero responsive rules.
- **Accessibility** — 57% of components have ARIA attributes. Missing: `aria-expanded` on collapsibles, `aria-describedby` on form fields, `aria-label` on icon buttons, systematic keyboard navigation.
- **Animation/motion** — 1 keyframe. All transitions hardcoded 0.15s. No duration/easing tokens. No loading spinners.
- **Icons** — only social platform icons. No generic UI icon system.
- **Button variants** — only `primaryButton`. No secondary, outline, danger, ghost.
- **Loading states** — each component invents its own. No shared spinner or skeleton.
- **Toast notifications** — errors inline only. No transient feedback system.
- **Light mode** — dark-only. No theme switching infrastructure.
- **CSS duplication** — `.heading` defined 4 times. Card, section, badge patterns duplicated per feature.

---

## Recommended Architecture

Three layers: **tokens** (design values) + **headless primitives** (accessible behavior) + **styled components** (our visual layer).

| Layer | Tool | License | Why |
|-------|------|---------|-----|
| Design tokens | CSS custom properties | N/A | Zero deps, W3C standard (Oct 2025 spec), designer updates values not components |
| Headless primitives | **Ark UI** (`@ark-ui/react`) | MIT | 45+ accessible components, CSS Modules friendly, Zag.js state machines |
| Styling | CSS Modules (keep current) | N/A | Scoped, no runtime, works with `var()` |
| Responsive | Container queries + `clamp()` | N/A | Modern, component-portable |
| Motion | CSS transitions + token durations | N/A | Simple, reduced-motion via token reset |
| Icons | **Lucide React** | ISC (MIT-compatible) | 1500+ icons, tree-shakeable, React components |
| Component playground | **Ladle** (deferred) | MIT | Vite-based, fast, add when 10+ shared components |
| A11y lint | `eslint-plugin-jsx-a11y` | MIT | Catches a11y issues at author time |
| A11y testing | `@axe-core/playwright` | MPL-2.0 | Automated WCAG checks in CI |

### Why Ark UI

**What it is:** A library that handles UI component *behavior* — keyboard navigation, focus management, screen reader announcements, open/close state — with zero visual styling. You write all the CSS yourself using CSS Modules.

**Why not build from scratch?** Building an accessible dropdown from scratch requires: escape-to-close, arrow key navigation, focus trapping, ARIA attributes, click-outside dismiss, animation coordination. Ark UI handles all of this. We write CSS, not interaction logic.

**Why Ark UI over alternatives?**

| Library | Fit | Notes |
|---------|-----|-------|
| **Ark UI** | Best | `data-scope`/`data-part`/`data-state` attributes map naturally to CSS Modules. 45+ components. React + Solid + Vue + Svelte. MIT. 18k stars. Chakra team. |
| **Radix Primitives** | Good | More mature ecosystem. React-only. Less natural for CSS Modules (uses `asChild` pattern instead of data attributes). |
| **shadcn/ui** | Poor fit | Requires Tailwind CSS. Beautiful defaults but wrong styling paradigm for our CSS Modules approach. |
| **React Aria (Adobe)** | Good | Most thorough a11y testing. Hooks-based API (heavier). Best if strict legal WCAG compliance needed. |
| **Building from scratch** | Bad | Weeks of accessibility work that Ark UI gives for free. High ongoing maintenance. |

**Lock-in risk:** Low. Ark UI components are thin wrappers — the visual layer is our CSS Modules. If Ark UI dies, we could swap to Radix Primitives with the same CSS. The behavioral API is similar across all headless libraries.

**Governance match:** MIT license. Published by the Chakra UI organization (established, well-funded open source team). Active development with regular releases. No CLA or contributor restrictions that conflict with cooperative values.

### Why Lucide React

**What it is:** 1500+ simple line icons as React components. Import only the ones you use — unused icons are excluded from the bundle automatically.

**Why not alternatives?**
- **Heroicons** — only 300 icons, Tailwind-oriented
- **react-icons** — bundles everything, poor tree-shaking
- **Custom SVGs** — time-consuming, inconsistent
- **Font Awesome** — complex licensing for the full set

**ISC license** — MIT-compatible, no restrictions.

---

## Phased Roadmap

### Phase 0: Token Foundation

Split `global.css` tokens into organized files. Add missing token categories.

```
styles/tokens/
  color.css        — primitive + semantic colors
  typography.css   — families, sizes (fluid clamp), weights, line-heights
  spacing.css      — scale + semantic spacing
  elevation.css    — shadows + z-index layers
  motion.css       — durations + easings
  radius.css       — border radius scale
```

Add `prefers-reduced-motion` token reset — all `--duration-*` tokens go to 0ms, disabling all animation globally.

**Migration cost:** Zero. Existing components keep working. New tokens are additive.

### Phase 1: Core UI Primitives

Install `@ark-ui/react`. Build styled wrappers for the primitives we need most:

1. Dialog/Modal — replace ad-hoc implementations
2. Menu/Dropdown — replace custom dropdown menus
3. Tooltip — replace title attributes and custom tooltips
4. Toast — new capability for transient feedback
5. Tabs — replace custom tab implementations
6. Select — replace native selects with accessible styled selects
7. Popover — replace custom popover implementations

Each primitive: `components/ui/{name}.tsx` + `{name}.module.css` styled with tokens + Ark data attributes.

### Phase 2: Shared Pattern Components

Extract duplicated patterns into shared components: Button (variants), Card (base), Badge (status), Heading (typed), Spinner, EmptyState, FormField (with `aria-describedby`).

Boy Scout rule — migrate when touching components for other reasons.

### Phase 3: Responsive Overhaul

Mobile-first + container queries. Layout shell first, then pages incrementally. Fluid typography via `clamp()`.

### Phase 4: Icon System

Install `lucide-react`. Add icons to nav, buttons, status indicators, empty states.

### Phase 5: Testing & Documentation

Add Ladle (component playground), `eslint-plugin-jsx-a11y`, `@axe-core/playwright`, Playwright visual regression.

### Phase 6: Theme System (when designer joins)

Light mode. Primitive color scales + semantic tokens. `[data-theme="dark"]` selector. Theme toggle in preferences.

---

## Priority & Effort

| Phase | Effort | Prerequisite |
|-------|--------|-------------|
| 0: Tokens | Small (1 session) | None |
| 1: Primitives | Medium (per component) | Phase 0 |
| 2: Patterns | Ongoing (Boy Scout) | Phase 0 |
| 3: Responsive | Large (dedicated release) | Phase 0 |
| 4: Icons | Small (1 session) | None |
| 5: Testing | Medium (setup) | Phase 1 (10+ components) |
| 6: Themes | Large | Designer |

---

## Skills & Tools to Build

- **Ark UI reference skill** — auto-trigger when working with `@ark-ui/react`. Covers component API, data attributes, styling patterns.
- **UI component patterns skill** — documents how to compose Ark UI + CSS Modules + tokens. Agents follow this when creating components.
- **`scan-design-system` rule library** — flags hardcoded colors/spacing/shadows, ad-hoc primitives that should use shared components, missing ARIA, desktop-first queries.
- **Expanded UX decisions doc** — when agents decide UI autonomously vs. ask the user.

---

## Sources

- Ark UI styling guide: ark-ui.com/docs/guides/styling
- W3C Design Tokens spec (Oct 2025): designtokens.org/tr/drafts/format
- Open Props (token naming reference): open-props.style
- WAI-ARIA APG patterns: w3.org/WAI/ARIA/apg/patterns
- Lucide icons: lucide.dev
- Ladle component playground: ladle.dev
- UX patterns research: `content-management-ux-patterns.md`
- UX decisions framework: `../docs/ux-decisions.md`
