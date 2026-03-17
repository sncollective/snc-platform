> **Archived**: 2026-03-09
> **Validation**: All tests passing, no cross-finding regressions

# Refactor Analysis: Styles — CSS Modules & Design Tokens

> **Generated**: 2026-03-09
> **Scope**: 62 CSS files — `apps/web/src/styles/*.css` + `apps/web/src/components/**/*.module.css` + `apps/web/src/routes/**/*.module.css`
> **Libraries researched**: CSS Modules (Vite built-in), clsx v2.x, React 19.2

---

## Executive Summary

Analyzed 62 CSS files across shared styles, component modules, and route modules. Found 0 P0 issues, 3 P1 high-value findings, 5 P2 medium-value findings, and 6 P3 nice-to-haves. The top takeaway is that the primary CTA button pattern is duplicated verbatim across 9+ files, form input styles are duplicated in 3 files that should use the shared `form.module.css`, and 4 undefined CSS custom properties are referenced without fallbacks or `:root` definitions. The existing shared module strategy (listing-page, landing-section, list-items, settings-page, form, error-alert) is well-designed and should be extended to cover buttons and section headings.

---

## P0 -- Fix Now

None found.

---

## P1 -- High Value

### 1. Primary CTA button duplicated across 9+ files

- **Affected files**:
  - `components/subscription/plan-card.module.css` (`.subscribeButton`)
  - `components/content/subscribe-cta.module.css` (`.subscribeButton`)
  - `components/creator/creator-header.module.css` (`.subscribeButton`, `.loginLink`)
  - `components/booking/service-card.module.css` (`.bookButton`)
  - `components/merch/product-detail.module.css` (`.buyButton`)
  - `routes/checkout/success.module.css` (`.primaryLink`)
  - `routes/checkout/cancel.module.css` (`.pricingLink`)
  - `routes/settings/creator-settings.module.css` (`.saveButton`)
  - `components/landing/hero-section.module.css` (`.primaryCta`)
- **Current state**: The same 8-property block is repeated with only class name differences:
  ```css
  padding: var(--space-sm) var(--space-xl);
  background: var(--color-accent);
  color: var(--color-bg);
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-ui);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s;
  ```
  Plus matching `:hover:not(:disabled)` and `:disabled` rules. Some use `border-radius: var(--radius-sm)` instead of `--radius-md`, and some include `text-decoration: none` for link variants.
- **Proposed consolidation**: Create `styles/button.module.css` with `.primaryButton`, `.primaryButtonLink` (adds `text-decoration: none; display: inline-block`), `.secondaryButton`, and `.outlineButton` (transparent + border) base classes. Component modules compose via dual-import pattern (same as `listing-page.module.css`). Each component keeps its own class for positioning overrides (e.g., `align-self: flex-start`).
- **Estimated scope**: New 1 file (~50 LOC), modify ~12 files removing ~120 LOC of duplicated button CSS, net -70 LOC
- **Pattern reference**: Extends `listing-page-shared-css` pattern to cover buttons
- **Tests affected**: None -- CSS-only refactor
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2. Form field styles duplicated outside shared `form.module.css`

- **Affected files**:
  - `styles/form.module.css` -- the canonical shared module (`.fieldGroup`, `.label`, `.input`, `.inputError`, `.fieldError`, `.serverError`, `.submitButton`)
  - `components/auth/auth-form.module.css` -- has its own page layout but auth forms also define input styles via `form.module.css` import (correctly)
  - `routes/settings/creator-settings.module.css` -- redeclares `.fieldGroup`, `.label`, `.input`, `.inputError`, `.fieldError`, `.select` (100% identical to `form.module.css`)
  - `components/content/content-form.module.css` -- redeclares `.textarea`, `.select` with identical input base styling
  - `components/booking/booking-form.module.css` -- redeclares `.textarea` with identical input base styling
- **Current state**: `creator-settings.module.css` (lines 17-69) contains a near-verbatim copy of `form.module.css` field styles. `content-form.module.css` and `booking-form.module.css` duplicate the textarea/select input base pattern that could be in the shared module.
- **Proposed consolidation**: (a) Have `creator-settings` import `formStyles` instead of redeclaring field styles. (b) Add `.textarea` and `.select` to `form.module.css` (they share the same input base). (c) `content-form.module.css` and `booking-form.module.css` import `formStyles` for textarea/select base, keep only overrides (e.g., `min-height`).
- **Estimated scope**: Modify `form.module.css` (+15 LOC for textarea/select), modify 3 component CSS files removing ~60 LOC
- **Pattern reference**: `css-modules-design-tokens` -- shared utility module pattern
- **Tests affected**: None -- CSS-only refactor
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 3. Section heading + section container pattern duplicated across 5 files

- **Affected files**:
  - `routes/dashboard.module.css` (`.section`, `.sectionHeading`)
  - `routes/emissions.module.css` (`.section`, `.sectionHeading`)
  - `routes/settings/content-settings.module.css` (`.section`, `.sectionHeading`)
  - `routes/creators/creator-detail.module.css` (`.section`, `.sectionHeading`)
  - `components/social-links/social-links-section.module.css` (`.section`, `.sectionHeading`)
- **Current state**: All 5 files define nearly identical patterns:
  ```css
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md); /* or --space-lg */
  }
  .sectionHeading {
    font-family: var(--font-heading);
    font-size: var(--font-size-xl);
    margin: 0;
  }
  ```
  Minor variations: `creator-detail` and `social-links-section` add `padding-bottom` + `border-bottom` to `.sectionHeading`; `content-settings` uses `padding-top` + `border-top`; `emissions` has no border. Comments in `creator-detail.module.css:17` and `social-links-section.module.css:9` acknowledge this duplication and suggest extracting to a shared module "if more consumers appear" -- 5 consumers now exist.
- **Proposed consolidation**: Create `styles/detail-section.module.css` with `.section` (flex column, gap `--space-md`) and `.sectionHeading` (heading font, xl size, margin 0). Variants with borders import the shared base and add border rules in their own module. This follows the existing `listing-page.module.css` pattern.
- **Estimated scope**: New 1 file (~15 LOC), modify 5 files removing ~30 LOC
- **Pattern reference**: `listing-page-shared-css` -- same dual-import pattern
- **Tests affected**: None -- CSS-only refactor
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P2 -- Medium Value

### 1. Undefined CSS custom properties referenced without `:root` definitions

- **Affected files**:
  - `routes/emissions.module.css` -- references `--color-surface`, `--color-surface-hover`, `--color-link`, `--color-link-hover`, `--color-primary`, `--color-primary-hover`
  - `components/admin/user-role-manager.module.css` -- references `--color-surface`
  - `components/emissions/impact-cards.module.css` -- references `--color-surface`
  - `components/social-links/social-links-section.module.css` -- references `--color-bg-hover`
- **Issue**: These tokens are not defined in `global.css` `:root`. Some have fallbacks (e.g., `var(--color-surface-hover, rgba(0, 0, 0, 0.03))`), but `--color-surface` and `--color-bg-hover` have no fallback, meaning they resolve to `initial` (transparent).
- **Suggestion**: Add the missing tokens to `global.css` `:root`:
  - `--color-surface: var(--color-bg-elevated)` (or a distinct value)
  - `--color-surface-hover: rgba(255, 255, 255, 0.05)` (appropriate for dark theme, not the light-theme `rgba(0,0,0,0.03)` fallback currently used)
  - `--color-bg-hover: rgba(255, 255, 255, 0.05)`
  - `--color-link: var(--color-accent)` and `--color-link-hover: var(--color-accent-hover)`
  - OR replace the references with existing tokens that already mean the same thing
- **Tests affected**: None
- **Verify**: [x] Visual regression check / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2. Page heading (`.heading`) duplicated across admin, dashboard, emissions, pricing, checkout pages

- **Affected files**:
  - `routes/admin.module.css` (`.heading`)
  - `routes/dashboard.module.css` (`.heading`)
  - `routes/emissions.module.css` (`.heading`)
  - `routes/pricing.module.css` (`.heading`)
  - `routes/checkout/cancel.module.css` (`.heading`)
  - `routes/checkout/success.module.css` (`.heading`)
  - `routes/settings/creator-settings.module.css` (`.heading`)
  - `routes/settings/content-settings.module.css` (`.heading`)
- **Issue**: All 8 files define the same pattern: `font-family: var(--font-heading); font-size: var(--font-size-2xl); margin: 0;`. The shared `listing-page.module.css` already has a `.heading` class with the same values, but these pages don't use `listing-page` because they're not listing pages.
- **Suggestion**: Either (a) create a minimal `styles/page-heading.module.css` with just `.heading`, or (b) rename the listing-page heading to be more generic and importable by non-listing pages. Option (a) is lower risk.
- **Tests affected**: None
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 3. Admin page duplicates listing-page load-more styles instead of importing them

- **Location**: `routes/admin.module.css`
- **Affected files**: `routes/admin.module.css`, `routes/admin.tsx`
- **Issue**: `admin.module.css` defines `.status`, `.loadMoreWrapper`, `.loadMoreButton` with identical CSS to `listing-page.module.css`. This violates the `listing-page-shared-css` pattern, which explicitly warns against "copying `.loadMoreButton` styles into a page-specific CSS module."
- **Suggestion**: Import `listingStyles` in `admin.tsx` and remove the duplicated classes from `admin.module.css`.
- **Tests affected**: `tests/unit/routes/admin.test.tsx` (if it asserts on class names)
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 4. `@keyframes chartPulse` duplicated between two chart modules

- **Location**: `components/dashboard/revenue-chart.module.css:99`, `components/emissions/emissions-chart.module.css:214`
- **Issue**: Both define identical `@keyframes chartPulse` animation for loading skeleton bars. While CSS Modules scope keyframes, having the same animation defined twice means changes must be synchronized.
- **Suggestion**: Since these are scoped by CSS Modules, this is low-risk. However, if a shared chart loading module is created later, consolidate into it. For now, document as acceptable duplication (CSS Modules scoping prevents conflicts).
- **Tests affected**: None
- **Verify**: [ ] Tests pass / [ ] No new public APIs / [ ] Behavior unchanged
- **Skipped**: Intentionally — CSS Modules scoping prevents conflicts; acceptable duplication per suggestion

### 5. Success feedback alert duplicated across 3 files

- **Affected files**:
  - `components/content/content-form.module.css` (`.success`, lines 95-102)
  - `routes/settings/creator-settings.module.css` (`.success`, lines 187-194)
  - Both define the same pattern: `padding: --space-sm --space-md; background: --color-success-bg; border: 1px solid --color-success; border-radius: --radius-sm; color: --color-success; font-size: --font-size-sm;`
- **Issue**: This mirrors the error-alert pattern that was already extracted to `error-alert.module.css`. A matching `success-alert.module.css` would complete the pair.
- **Suggestion**: Create `styles/success-alert.module.css` with `.success` class, or extend `error-alert.module.css` to `feedback-alert.module.css` with both `.error` and `.success`.
- **Tests affected**: None
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P3 -- Nice-to-Have

- **Hardcoded `#000` in `video-player.module.css:7`**: Should be `var(--color-bg)` or a new `--color-black` token. Minor because video backgrounds are intentionally pure black.
- **Hardcoded `#fff` in `emissions.module.css:251`** (`.offsetBadge color`): Should use `var(--color-bg)` or a text-on-badge token.
- **Hardcoded `rgba(91, 181, 181, 0.1)` in `services.module.css:29`**: Should be `var(--color-secondary)` with opacity, or a new derived token like `--color-secondary-bg`. The `rgba(0, 0, 0, 0.6)` in `content-card.module.css:82` for lock overlay is acceptable as a one-off transparency effect.
- **`box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3)` duplicated in 3 card hover states**: `content-card`, `creator-card`, and `product-card` all use the same shadow. This value matches `--shadow-dropdown` in `global.css`. Using the token would centralize changes: `box-shadow: var(--shadow-dropdown)`.
- **`landing-section.module.css` heading uses hardcoded `1.5rem` instead of `var(--font-size-2xl)`**: Line 12 -- `font-size: 1.5rem` is the same value as `--font-size-2xl` but hardcoded.
- **Inconsistent gap values in `.section` containers**: `dashboard.module.css` and `content-settings.module.css` use `gap: var(--space-md)`, while `creator-detail.module.css` and `social-links-section.module.css` use `gap: var(--space-lg)`, and `emissions.module.css` uses `gap: var(--space-md)`. When consolidated (P1-3), pick one default and let overrides handle the rest.

---

## Skip -- Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| `.divider` defined in 3 modules | `written-detail`, `content-footer`, `footer`, `mobile-menu`, `user-menu` | Each is scoped to its component and uses CSS Modules isolation. The CSS is trivial (1-2 lines) and merging would create a cross-component dependency for no real benefit. |
| `.empty` state in chart/table components | `revenue-chart`, `pending-bookings-table`, `emissions-chart`, `breakdown-table` | These are domain-specific empty states with different heights and layouts. The shared `list-items.module.css` `.empty` serves a different structural context (list items). |
| `.card` class in multiple components | `content-card`, `creator-card`, `product-card`, `service-card`, `kpi-card`, `plan-card`, `impact-cards` | Each card type has substantially different inner structure and sizing. A shared base would create fragile coupling. The design tokens ensure visual consistency already. |
| Audio progress bar styles in `audio-player` vs `mini-player` | `audio-player.module.css`, `mini-player.module.css` | The mini-player has different thumb sizes (10px vs 12px) and omits `:disabled` state. These are intentionally separate components per the `react-context-reducer-provider` pattern. |
| `.sectionHeading` in `creator-detail` vs `social-links-section` | Both files | The comments in both files acknowledge this mirror and keep it separate. However, with 5 consumers now, this should be consolidated (moved to P1-3 above). |

---

## Best Practices Research

### CSS Modules (Vite built-in)

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| Template literal class composition (`${styles.a} ${styles.b}`) | `composes:` keyword in CSS for static composition; template literals for dynamic/conditional | Low -- `composes` can gradually replace static multi-class patterns |
| Shared modules via dual-import in TSX | Continue this pattern -- it is idiomatic CSS Modules | N/A |
| No `composes` usage anywhere in codebase | Use `composes: baseClass from './shared.module.css'` for inheriting shared base styles | Low -- opt-in per class |

The `composes` keyword is a first-class CSS Modules feature that generates multi-class output at build time. It is particularly well-suited for the button consolidation (P1-1): component modules could use `composes: primaryButton from '../../styles/button.module.css'` to inherit base button styles and then override positioning. However, the existing dual-import pattern is also valid and more explicit in JSX. Either approach works; the team should choose one and document it.

### CSS `@property` (2025-2026)

The `@property` at-rule allows typed, animatable custom properties. This is relevant to the design tokens in `global.css` but low priority -- current tokens are static and don't need animation interpolation. Worth noting for future theming work.

### CSS `@scope` (2025-2026)

Native CSS scoping is reaching broad browser support. It provides proximity-based styling as a potential alternative to CSS Modules. However, migration would be high-effort and CSS Modules remain the better choice for a Vite + React project with established conventions.

---

## OSS Alternatives

| Hand-rolled Code | Package | Weekly DL | Stack Fit | Notes |
|-----------------|---------|-----------|-----------|-------|
| Template literal class composition in JSX | [clsx](https://www.npmjs.com/package/clsx) | ~30M | Yes | 239 bytes. Drop-in for conditional class composition. Replaces `${styles.a} ${condition ? styles.b : ''}` with `clsx(styles.a, condition && styles.b)`. The codebase currently has very few conditional class compositions, so the benefit is marginal. Recommend evaluating when the number of conditional compositions grows. |

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `css-modules-design-tokens` | Partial Fix | Undefined tokens fixed (P2-1); 2 hardcoded hex values (P3) and 1 hardcoded rem value (P3) remain as unimplemented nice-to-haves |
| `listing-page-shared-css` | Fixed | `admin.module.css` now imports listing-page styles (P2-3) |
| `content-type-dispatch` | Compliant | Content type badge classes properly use `Record<Type, string>` with CSS module classes |
| `react-context-reducer-provider` | Compliant | Audio player CSS split between `audio-player` and `mini-player` is intentional |

---

## Suggested Implementation Order

1. **P2-1: Define missing CSS custom properties in `global.css`** -- Zero risk, fixes potential invisible styling bugs now. No test changes needed.
2. **P1-1: Extract shared button module** -- Highest duplication count (9+ files), most LOC reduction (~120 lines removed).
3. **P1-2: Consolidate form field styles** -- `creator-settings` is a near-verbatim copy; add textarea/select to shared `form.module.css`.
4. **P2-3: Fix admin page to import listing-page styles** -- Direct pattern violation, simple fix.
5. **P1-3: Extract shared section heading module** -- 5 consumers justify the extraction per the existing comments in the code.
6. **P2-2: Extract shared page heading** -- 8 duplicates, but very small (3 properties each), so lower impact than buttons/forms.
7. **P2-5: Extract success alert to match error-alert pattern** -- Extends existing shared module strategy.
8. **P3 items** -- Opportunistic cleanup when touching affected files.

Order by: undefined tokens first (correctness) -> highest duplication count -> pattern violations -> minor cleanup.
