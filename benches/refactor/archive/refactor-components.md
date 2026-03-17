> **Archived**: 2026-03-09
> **Validation**: All tests passing, no cross-finding regressions

# Refactor Analysis: Web Components

> **Generated**: 2026-03-09
> **Scope**: `apps/web/src/components/**/*.tsx` + `.module.css` — 47 TSX files, 43 CSS modules
> **Libraries researched**: React 19.2.4, TanStack Start 1.162.2, TanStack Router 1.163.2, zod 4.3.6 (zod/mini), CSS Modules (via Vite 7.3.1), simple-icons 16.10.0

---

## Executive Summary

Analyzed 47 component files and 43 CSS module files across 12 component directories. Found 0 security issues (P0), 3 high-value consolidation opportunities (P1), 6 medium-value improvements (P2), and 8 nice-to-have items (P3). The highest-impact finding is **form CSS duplication** — identical `.input`, `.fieldError`, `.submitButton`, `.label`, `.fieldGroup`, `.inputError`, and `.serverError` declarations are copy-pasted across three separate CSS modules (`auth-form`, `booking-form`, `content-form`). The second is **duplicate checkout/subscribe handler logic** repeated across 3 components. The third is a large single-file component (`emissions-chart.tsx` at 416 lines) with chart-math helpers that could be extracted.

---

## P0 — Fix Now

None found.

---

## P1 — High Value

### 1. Form CSS Duplication Across Three Modules

- **Affected files**:
  - `apps/web/src/components/auth/auth-form.module.css`
  - `apps/web/src/components/booking/booking-form.module.css`
  - `apps/web/src/components/content/content-form.module.css`
- **Current state**: The following CSS declarations are near-identical across all three files:
  - `.fieldGroup` (flex column, gap xs)
  - `.label` (font-size-sm, weight 500, color-text)
  - `.input` (padding, bg-input, border, radius, color, font, transition)
  - `.input:focus` (accent border)
  - `.inputError` (error border)
  - `.fieldError` (font-size-xs, color-error)
  - `.serverError` (padding, error-bg, border, radius, color, font-size-sm)
  - `.submitButton` (padding, accent bg, font-weight 600, hover/disabled states)

  The only real differences are: `auth-form` has `max-width: 400px` on `.form`, `booking-form` has `.form` with elevated bg + border + padding, and `content-form` has additional file-input and success-message styles. The 8 shared declarations are identical.

- **Proposed consolidation**: Create `apps/web/src/styles/form.module.css` as a shared form CSS module (following the same pattern as `listing-page.module.css` and `list-items.module.css`). Extract the 8 common classes into it. Each form component imports the shared module for base styles and keeps its own module only for form-specific additions. This follows the established `listing-page-shared-css` pattern exactly.
- **Estimated scope**: 4 files to change (3 existing CSS modules + 1 new shared module), ~80 lines removed from existing files, ~40 lines in new shared file. Net -40 LOC.
- **Pattern reference**: `listing-page-shared-css` — extend the same dual-import pattern to forms
- **Tests affected**: None — CSS-only change, no component logic changes
- **Verify**: [x] Tests pass without modification / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2. Duplicate Checkout/Subscribe Handler Pattern

- **Affected files**:
  - `apps/web/src/components/content/subscribe-cta.tsx` (lines 80-88)
  - `apps/web/src/components/creator/creator-header.tsx` (lines 36-44)
  - `apps/web/src/components/landing/hero-section.tsx` (lines 26-53)
  - `apps/web/src/components/landing/landing-pricing.tsx` (lines 29-43)
- **Current state**: All four components implement the same checkout flow:
  ```typescript
  const handleSubscribe = async (planId: string) => {
    setCheckoutLoading(true);
    try {
      const url = await createCheckout(planId);
      navigateExternal(url);
    } catch {
      setCheckoutLoading(false);
    }
  };
  ```
  Each component independently manages `checkoutLoading` state. `hero-section` and `landing-pricing` additionally duplicate the `isAuthenticated` + `isSubscribed` derivation from `useSession()` + `useSubscriptions()`.
- **Proposed consolidation**: Extract a `useCheckout()` hook into `apps/web/src/hooks/use-checkout.ts` that encapsulates `checkoutLoading` state + `handleCheckout(planId)` + optional auth redirect. All four components import the hook instead of duplicating the try/catch/navigate flow.
- **Estimated scope**: 5 files (1 new hook, 4 component updates), ~15 lines per component simplified
- **Pattern reference**: Follows `use-cursor-pagination` extraction pattern
- **Tests affected**: `tests/unit/components/subscribe-cta.test.tsx`, `tests/unit/components/creator-header.test.tsx`, `tests/unit/components/landing/hero-section.test.tsx`, `tests/unit/components/landing/landing-pricing.test.tsx` — mock the new hook instead of mocking `createCheckout` + `navigateExternal` separately
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 3. EmissionsChart Complexity — Extract Chart Math Helpers

- **Affected files**:
  - `apps/web/src/components/emissions/emissions-chart.tsx` (416 lines)
- **Current state**: This single file contains:
  - 7 private helper functions (`formatCo2Kg`, `formatMonthLabel`, `formatMonthShort`, `computeChartLines`, `niceNum`, `niceTicks`, inline `xForIndex`/`yForValue`/`makePolyline`)
  - Complex SVG rendering with tooltip state
  - A `MONTHS` array duplicated in two separate helper functions (lines 42-44 and lines 51-53)
  - At 416 lines, it is the longest component file in the codebase by a wide margin
- **Proposed consolidation**: Extract chart math into `apps/web/src/lib/chart-math.ts`:
  - `niceNum`, `niceTicks`, `computeChartLines` — pure functions, easily unit-testable
  - `formatCo2Kg`, `formatMonthLabel`, `formatMonthShort` — formatting helpers
  - Deduplicate the `MONTHS` array into a single constant
  The component file drops to ~250 lines (SVG rendering only).
- **Estimated scope**: 2 files (1 new lib module, 1 component refactor), ~120 lines extracted
- **Pattern reference**: New pattern needed — "chart-math-extraction" or could be a general "extract-pure-helpers" guideline
- **Tests affected**: `tests/unit/components/emissions/emissions-chart.test.tsx` — existing `computeChartLines` tests move to the new lib module; component tests remain for rendering
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P2 — Medium Value

### 1. Duplicate Volume Control UI in AudioPlayer and MiniPlayer

- **Location**: `apps/web/src/components/media/audio-player.tsx`, `apps/web/src/components/media/mini-player.tsx`
- **Affected files**: Both files
- **Issue**: Both components duplicate:
  - Identical volume SVG icon (3 paths, same viewBox/dimensions, lines 107-111 in audio-player, 104-108 in mini-player)
  - Same volume slider `<input type="range">` with identical min/max/step/aria-label
  - Same `handleVolumeChange` callback pattern (parse number, setVolume, actions.setVolume)
  - Same `handleSeek` pattern
  - Same play/pause button with identical emoji characters and aria-labels
- **Suggestion**: Extract a `VolumeControl` presentational component and optionally a `PlayPauseButton` component into `components/media/`. Both AudioPlayer and MiniPlayer compose them.
- **Tests affected**: `tests/unit/components/media/audio-player.test.tsx`, `tests/unit/components/media/mini-player.test.tsx`
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2. Locked Content Rendering Pattern in Detail Variants

- **Location**: `apps/web/src/components/content/video-detail.tsx`, `audio-detail.tsx`, `written-detail.tsx`
- **Affected files**: All three detail variant components
- **Issue**: Each variant duplicates the locked/unlocked branching structure: check `locked === true`, render a locked state with `<SubscribeCta>`, or render the full content. All three share the same structural pattern: `if (locked) { return lockedView with SubscribeCta; } return fullView;`. The description rendering (`{item.description && (<><hr .../><p ...>{item.description}</p></>)}`) is also identical in video-detail and audio-detail.
- **Suggestion**: This is borderline — each variant's locked UI is visually distinct (video shows thumbnail overlay, audio shows cover art, written shows text preview with fade). However, the shared description block and the SubscribeCta placement could be extracted into a `ContentFooter` micro-component that renders description + optional SubscribeCta. This would reduce ~8 lines from each variant.
- **Tests affected**: `tests/unit/components/content/video-detail.test.tsx`, `audio-detail.test.tsx`, `written-detail.test.tsx`
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 3. Hero + LandingPricing Auth/Subscription State Derivation

- **Location**: `apps/web/src/components/landing/hero-section.tsx`, `landing-pricing.tsx`
- **Affected files**: Both landing components
- **Issue**: Both components independently derive the same values:
  ```typescript
  const session = useSession();
  const subscriptions = useSubscriptions();
  const isAuthenticated = session.data !== null && session.data !== undefined;
  const isSubscribed = hasPlatformSubscription(subscriptions);
  ```
  This is already partially addressed by P1 Finding 2 (useCheckout hook). If the hook doesn't absorb the auth state, consider a `usePlatformAuth()` hook that returns `{ isAuthenticated, isSubscribed, session }` to eliminate this 4-line boilerplate from both components.
- **Suggestion**: Bundle into the `useCheckout()` hook from P1-2, or create a separate `usePlatformAuth()` in `hooks/`.
- **Tests affected**: Same as P1-2
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 4. Inline Style in ContentForm

- **Location**: `apps/web/src/components/content/content-form.tsx:147`
- **Affected files**: `content-form.tsx`, `content-form.module.css`
- **Issue**: `style={{ fontSize: "var(--font-size-sm)" }}` is used inline for the server error div instead of applying a CSS module class. This violates the `css-modules-design-tokens` pattern which states "Inline styles (`style={{ color: '...' }}`) — use CSS Modules instead".
- **Suggestion**: The `content-form.module.css` already has a `.fieldError` class, but it's being reused for server errors with an inline override. Add a dedicated `.serverError` class (same as `auth-form.module.css` and `booking-form.module.css` already have) or use the shared form module from P1-1.
- **Tests affected**: None
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 5. ProductCard Uses div[role="link"] Instead of Anchor/Link

- **Location**: `apps/web/src/components/merch/product-card.tsx:32-39`
- **Affected files**: `product-card.tsx`
- **Issue**: The component renders a `<div role="link" tabIndex={0}>` with `onClick` and `onKeyDown` handlers to navigate to the product detail page. This is semantically inferior to using a `<Link>` component (which ContentCard and CreatorCard both use correctly). The custom keyboard handler only handles Enter and Space, missing other accessibility expectations of a real link (right-click context menu, Ctrl+click for new tab, etc.).
- **Suggestion**: Replace the `div[role="link"]` with a TanStack Router `<Link>` component, matching the pattern used by `ContentCard` and `CreatorCard`. The creator link inside the card can use `onClick={(e) => e.stopPropagation()}` as it already does, but inside a proper `<Link>` wrapper instead of a div.
- **Tests affected**: `tests/unit/components/merch/product-card.test.tsx`
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 6. Image/Avatar Placeholder Pattern Repeated Without Abstraction

- **Location**: `creator-card.tsx`, `creator-header.tsx`, `content-card.tsx`, `mini-player.tsx`, `product-card.tsx`, `product-detail.tsx`
- **Affected files**: 6 component files
- **Issue**: The pattern `{src ? <img ... /> : <div className={styles.placeholder} />}` is repeated across 6+ components with slight variations. Each defines its own placeholder div with similar CSS (background color from token, border-radius, aspect ratio).
- **Suggestion**: This is a soft recommendation. An `OptionalImage` presentational component (`{ src, alt, className, placeholderClassName }`) would eliminate the ternary from all call sites. However, each usage has different sizing and layout context, so the benefit is incremental (~3 lines per call site). Consider deferring this until the pattern appears in additional components.
- **Tests affected**: None significant — the new component would be trivially testable
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P3 — Nice-to-Have

- `apps/web/src/components/emissions/emissions-chart.tsx:42-44,51-53`: `MONTHS` array literal duplicated in `formatMonthLabel` and `formatMonthShort` — extract to module constant (addressed by P1-3 if implemented)
- `apps/web/src/components/content/written-detail.tsx:21-27`: `truncateToWords` is a generic utility — could live in `lib/format.ts` for reuse
- `apps/web/src/components/layout/user-menu.tsx:13-21`: `getInitials` is a generic utility — could live in `lib/format.ts`
- `apps/web/src/components/dashboard/revenue-chart.tsx:9-12`: `MONTH_LABELS` array is also defined in `emissions-chart.tsx` — shared constant candidate (but only 2 usages, low urgency)
- `apps/web/src/components/booking/booking-list.tsx:17-19`: `getStatusClass` uses non-null assertion (`styles.statusApproved!`) on 3 lines — could use `?? ""` fallback for safety
- `apps/web/src/components/landing/featured-creators.tsx:11`, `recent-content.tsx:12`: Interface props lack `readonly` modifier, inconsistent with all other component props in the codebase
- `apps/web/src/components/landing/landing-pricing.tsx:17`, `hero-section.tsx:12`: Same `readonly` omission on interface props
- `apps/web/src/components/content/content-form.tsx`: At 377 lines, this is the second-longest component; the three file-input blocks (media, cover art, thumbnail) follow an identical pattern — a small `FileInputField` sub-component would eliminate ~60 lines of repetition

---

## Skip — Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| Separate detail variant components (VideoDetail, AudioDetail, WrittenDetail) | `content/` | `content-type-dispatch` pattern — each variant extracts type-specific fields from shared FeedItem; merging would create a monolithic component |
| Separate `TYPE_BADGE_LABELS` / `TYPE_BADGE_CLASSES` Records | `content-card.tsx` | `content-type-dispatch` pattern — exhaustive Record ensures TypeScript catches missing types |
| BookingList vs SubscriptionList both using `list-items.module.css` | `booking/`, `subscription/` | `listing-page-shared-css` pattern — shared base styles with domain-specific overrides |
| Each landing section component imports `landing-section.module.css` separately | `landing/` | `listing-page-shared-css` pattern — documented dual-import approach |
| `PlatformIcon` PLATFORM_ICONS Record | `social-links/platform-icon.tsx` | Exhaustive `Record<SocialPlatform, ...>` ensures all platforms have icons; similar to content-type-dispatch |
| Private `getStatusLabel`/`getStatusClass` in subscription-list vs booking-list | `subscription/`, `booking/` | `row-to-response-transformer` pattern — different domains with different status semantics (booking has approved/denied/pending; subscription has active/canceling/canceled/past_due) |

---

## Best Practices Research

### React v19.2.4

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| Manual `useMemo`/`useCallback` everywhere | React Compiler (auto-memoization) available since 19.x — eliminates manual memoization | Medium — requires React Compiler Babel plugin; can be adopted incrementally per file |
| `useEffect` for data fetching in `subscribe-cta.tsx` | Use `loader` in route files (TanStack Start pattern) for server-side data fetching; reserve `useEffect` for client-only side effects | Low — `subscribe-cta.tsx` is the only component doing client-side data fetching via `useEffect`; plans could be passed as props from the route loader |
| Template literal class composition (`${styles.a} ${styles.b}`) | Still fine — no built-in alternative. Consider `clsx/lite` (140 bytes) for 3+ condition compositions | Low |

### TanStack Start v1.162.2

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| Components fetch data via hooks/useEffect | Prefer `loader` + `Route.useLoaderData()` for all server data; components receive data as props | Low — most components already follow this; `subscribe-cta.tsx` is the exception |
| No `createServerFn` usage in components | Correct — components should not call server functions directly; routes handle this | N/A — already compliant |

### CSS Modules (via Vite 7.3.1)

| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| Template literal conditional classes | Add `clsx/lite` (140B gzipped) for cleaner multi-condition class composition | Low — optional; current approach works fine for 1-2 conditions |
| Shared CSS modules (`listing-page`, `list-items`, `landing-section`) | Pattern is solid and well-established; extend to forms (P1-1) | N/A — already best practice |

---

## OSS Alternatives

| Hand-rolled Code | Package | Weekly DL | Stack Fit | Notes |
|-----------------|---------|-----------|-----------|-------|
| `emissions-chart.tsx` hand-rolled SVG chart (416 lines) | [unovis](https://unovis.dev/) | ~8K | Partial | TypeScript-first, CSS variable theming (matches design token pattern). However, the emissions chart is highly custom (multi-line cumulative, color-coded net segments, offset dots). Migration effort would be high and may not reduce complexity. **Recommendation: keep hand-rolled, but extract math helpers (P1-3).** |
| `emissions-chart.tsx` | [recharts](https://recharts.org/) | ~2.5M | Yes | Most popular React SVG chart lib. Would simplify the rendering layer but lose the custom net-line coloring and offset-dot placement. Bundle adds ~45KB gzipped. **Not recommended** given the highly custom visualization. |
| Template literal class composition | [clsx/lite](https://github.com/lukeed/clsx) | ~14M | Yes | 140 bytes gzipped. Drop-in improvement for 3+ condition class strings. Low-risk adoption. **Recommended as optional P3 enhancement.** |
| `revenue-chart.tsx` hand-rolled bar chart (88 lines) | N/A | — | — | Too simple to justify a library — just CSS-height bars in a flex row. Keep as-is. |

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `css-modules-design-tokens` | **Fixed** | `content-form.tsx` inline style replaced with shared `form.module.css` class (P2-4). `emissions-chart.module.css` uses hardcoded `8px`, `9px`, `10px` font sizes for SVG text elements (acceptable — rem units behave differently in SVG). |
| `content-type-dispatch` | Compliant | `content-detail.tsx` dispatches correctly; `content-card.tsx` uses exhaustive Records. |
| `listing-page-shared-css` | Compliant | Feed, creators, merch, my-content-list all import `listing-page.module.css`. Landing sections import `landing-section.module.css`. |
| `react-context-reducer-provider` | Compliant | `audio-player-context` follows the pattern exactly. `AudioPlayer` and `MiniPlayer` consume it correctly. |
| `zod-mini-form-validation` | Compliant | `login-form`, `register-form`, `booking-form`, `content-form` all use `zod/mini` + `safeParse` + `extractFieldErrors`. |
| `vi-hoisted-module-mock` | N/A | Component source files — applies to test files only. |
| `use-cursor-pagination` | Compliant | `my-content-list.tsx` uses `useCursorPagination` correctly. |
| `web-fetch-client` | Compliant | Components use `lib/` fetch helpers, never raw `fetch`. |

---

## Suggested Implementation Order

1. **P1-1: Shared Form CSS Module** — Zero-risk CSS extraction. Creates a reusable `form.module.css` following the established shared-CSS pattern. No test changes needed.
2. **P2-4: Fix ContentForm Inline Style** — Quick fix, 2-minute change, resolves pattern violation. Can bundle with P1-1.
3. **P1-3: Extract EmissionsChart Math Helpers** — Pure function extraction into `lib/chart-math.ts`. Reduces largest component by ~120 lines. Test relocation is straightforward.
4. **P1-2: Extract useCheckout Hook** — Consolidates 4 components' checkout logic. Requires test updates but reduces coupling.
5. **P2-5: Fix ProductCard Semantic HTML** — Accessibility improvement. Replace `div[role="link"]` with real `<Link>`.
6. **P2-1: Extract VolumeControl Component** — Media component consolidation, moderate scope.
7. **P2-3: Absorb Auth State Derivation** — Bundle with P1-2 if implementing useCheckout hook.
8. **P2-2: ContentFooter Micro-Component** — Lower value, touch-when-nearby.
9. **P2-6: OptionalImage Component** — Incremental improvement, defer until more call sites appear.
10. **P3 items** — Opportunistic, handle when touching the relevant files.
