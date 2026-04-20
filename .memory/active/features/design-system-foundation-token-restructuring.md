---
id: feature-design-system-foundation-token-restructuring
kind: feature
stage: done
tags: [design-system]
release_binding: 0.2.1
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: design-system-foundation
---

# Design System Foundation — Token Restructuring (Phase 0)

## Overview

Split the monolithic `:root` token block in `global.css` into organized category files under `styles/tokens/`. Add missing token categories (motion, elevation, typography weights/line-heights, fluid typography). Define tokens that are referenced in the codebase but never declared. Keep all existing `var()` references working — property names do not change.

## Implementation Units

### Unit 1: `styles/tokens/color.css`

**File:** `platform/apps/web/src/styles/tokens/color.css`

```css
/* ── Color Tokens ── */

:root {
  /* Primitives */
  --color-bg: #1a1a2e;
  --color-bg-elevated: #252542;
  --color-bg-input: #2a2a4a;
  --color-bg-hero-gradient: #1e1e36;
  --color-text: #f0f0f0;
  --color-text-muted: #a0a0b0;
  --color-accent: #f5a623;
  --color-accent-hover: #e09510;
  --color-secondary: #5bb5b5;
  --color-error: #ef5350;
  --color-border: #3a3a5c;
  --color-media-bg: #000;
  --color-text-on-color: #fff;

  /* Semantic surfaces */
  --color-surface: var(--color-bg-elevated);
  --color-surface-hover: rgba(255, 255, 255, 0.05);
  --color-bg-hover: rgba(255, 255, 255, 0.05);

  /* Semantic links */
  --color-link: var(--color-accent);
  --color-link-hover: var(--color-accent-hover);

  /* Status backgrounds */
  --color-error-bg: rgba(239, 83, 80, 0.1);
  --color-success: #4caf50;
  --color-success-bg: rgba(76, 175, 80, 0.1);
  --color-accent-bg: rgba(245, 166, 35, 0.1);
  --color-secondary-bg: rgba(91, 181, 181, 0.1);

  /* Content type badges */
  --color-badge-video-bg: rgba(245, 166, 35, 0.85);
  --color-badge-audio-bg: rgba(91, 181, 181, 0.85);
  --color-badge-written-bg: rgba(160, 160, 176, 0.6);

  /* Overlay */
  --overlay-lock: rgba(0, 0, 0, 0.6);

  /* ── Missing tokens (referenced in codebase but never defined) ── */

  /* Used by: chat-panel, follow-button, chat-moderation-panel, set-password-banner, admin-creators */
  --color-primary: var(--color-accent);
  --color-primary-text: var(--color-text-on-color);
  --color-primary-subtle: color-mix(in srgb, var(--color-primary) 15%, transparent);

  /* Used by: playout admin */
  --color-muted: var(--color-text-muted);

  /* Used by: content-manage, playout, draft-content-list */
  --color-text-on-accent: var(--color-text-on-color);

  /* Used by: reaction-picker */
  --color-text-secondary: var(--color-text-muted);

  /* Used by: video-detail, audio-detail, written-detail */
  --color-bg-alt: var(--color-bg-elevated);

  /* Used by: playout admin, content-editor */
  --color-warning: hsl(40 90% 55%);
}
```

**Implementation Notes:**
- Every existing token from `global.css` lines 4-71 moves here unchanged.
- Missing tokens are defined as aliases to existing tokens where intent is clear. `--color-primary` aliases `--color-accent` (the codebase uses them interchangeably). `--color-warning` uses the fallback value already present in `playout.module.css`.
- `color-mix()` for `--color-primary-subtle` has 96%+ browser support (baseline 2023). Matches the fallback already used in `chat-panel.module.css` and `reaction-picker.module.css`.

**Acceptance Criteria:**
- [x] All 27 existing color tokens present with identical values
- [x] All 7 previously-undefined color tokens (`--color-primary`, `--color-primary-text`, `--color-primary-subtle`, `--color-muted`, `--color-text-on-accent`, `--color-text-secondary`, `--color-bg-alt`, `--color-warning`) defined
- [x] Existing components render identically — no visual regression

---

### Unit 2: `styles/tokens/typography.css`

**File:** `platform/apps/web/src/styles/tokens/typography.css`

```css
/* ── Typography Tokens ── */

:root {
  /* Font families */
  --font-ui: "Inter", system-ui, -apple-system, sans-serif;
  --font-heading: Georgia, "Times New Roman", serif;

  /* Font sizes — fixed scale */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 2rem;

  /* Fluid typography — headings scale with viewport */
  --font-size-3xl-fluid: clamp(1.75rem, 1rem + 2vw, 2.5rem);
  --font-size-2xl-fluid: clamp(1.35rem, 0.9rem + 1.5vw, 1.75rem);

  /* Font weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Line heights */
  --line-height-tight: 1.2;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.6;

  /* Letter spacing */
  --letter-spacing-tight: -0.01em;
  --letter-spacing-normal: 0;
  --letter-spacing-wide: 0.025em;

  /* ── Missing token (referenced but never defined) ── */

  /* Used by: project detail pages */
  --font-size-md: var(--font-size-base);
}
```

**Implementation Notes:**
- All 9 existing typography tokens move here unchanged.
- Fluid sizes are additive — `--font-size-3xl` keeps its fixed value, `--font-size-3xl-fluid` is new. Components opt in to fluid by using the `-fluid` variant. No existing components break.
- `--font-weight-semibold` (600) added because it's hardcoded in `global.css` line 198 (`.skip-link`) and used across many component CSS files.
- `--line-height-relaxed` (1.6) matches the body `line-height` in `global.css` line 95.
- `--font-size-md` aliases `--font-size-base` — the two project detail pages that reference it use it interchangeably with `--font-size-base`.

**Acceptance Criteria:**
- [x] All 9 existing typography tokens present with identical values
- [x] Fluid variants, weights, line-heights, and letter-spacing tokens defined
- [x] `--font-size-md` defined (previously missing)

---

### Unit 3: `styles/tokens/spacing.css`

**File:** `platform/apps/web/src/styles/tokens/spacing.css`

```css
/* ── Spacing Tokens ── */

:root {
  /* Scale */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;

  /* Layout */
  --content-max-width: 1200px;
  --nav-height: 64px;
  --sidebar-width: 240px;
  --sidebar-width-collapsed: 0px;
  --context-topbar-height: 48px;
  --mini-player-height: 0px;
  --mini-upload-height: 0px;
}
```

**Implementation Notes:**
- All 6 spacing tokens and 7 layout tokens move here unchanged.
- Layout tokens stay in this file rather than a separate layout file — they're spacing-adjacent and there aren't enough to justify a separate file.
- The sub-agent found references to `--space-1`, `--space-2`, `--space-half`, etc. in the codebase. These are **not** defined here — they appear to be from an early draft and the references should be cleaned up during the hardcoded values migration pass (parked backlog item), not in this restructuring.

**Acceptance Criteria:**
- [x] All 13 existing spacing/layout tokens present with identical values

---

### Unit 4: `styles/tokens/elevation.css`

**File:** `platform/apps/web/src/styles/tokens/elevation.css`

```css
/* ── Elevation Tokens ── */

:root {
  /* Shadows */
  --shadow-xs: 0 1px 3px rgba(0, 0, 0, 0.2);
  --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);
  --shadow-xl: 0 12px 32px rgba(0, 0, 0, 0.5);

  /* Named z-index layers */
  --z-base: 1;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-overlay: 300;
  --z-modal: 400;
  --z-toast: 500;
  --z-skip-link: 1000;
}
```

**Implementation Notes:**
- `--shadow-md` replaces the existing `--shadow-dropdown` value. `--shadow-dropdown` is removed — consumers should use `--shadow-md` instead. However, to avoid breaking the 1 reference, `global.css` will keep a backwards-compat alias: `--shadow-dropdown: var(--shadow-md)`.
- `--shadow-sm` is the missing token referenced in `reaction-picker.module.css`. Value (`0 4px 12px rgba(0, 0, 0, 0.3)`) matches the hardcoded shadow used in 4 component files.
- Z-index layers map to current codebase usage: `1` (base stacking), `100` (nav), `200` (dropdowns, global player), `300` (overlays), `400` (modals), `500` (toasts, notification bell), `1000` (skip link, already hardcoded in `global.css` line 193).
- Current hardcoded z-values (10, 50, 100, 101, 150, 200) map to this layer system. The dedicated migration backlog item will update component files.

**Acceptance Criteria:**
- [x] Shadow scale defined (xs through xl)
- [x] `--shadow-sm` resolves the missing token reference in `reaction-picker.module.css`
- [x] Z-index layers defined matching the layer plan from the scoping brief
- [x] `--shadow-dropdown` preserved as backwards-compat alias in `global.css`

---

### Unit 5: `styles/tokens/motion.css`

**File:** `platform/apps/web/src/styles/tokens/motion.css`

```css
/* ── Motion Tokens ── */

:root {
  /* Durations */
  --duration-instant: 50ms;
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-moderate: 300ms;
  --duration-slow: 500ms;

  /* Easing curves */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Reduced motion — reset all durations to near-zero */
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-instant: 0ms;
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-moderate: 0ms;
    --duration-slow: 0ms;
  }
}
```

**Implementation Notes:**
- Entirely new tokens — the codebase currently has zero motion tokens.
- The `prefers-reduced-motion` reset here targets token-based animations. The existing blanket `animation-duration: 0.01ms !important` rule in `global.css` remains as a safety net for any non-token animations.
- `--duration-normal` (200ms) is slightly higher than the current dominant hardcoded value (0.15s / 150ms). 200ms is the standard Material Design recommendation. The 50ms difference is imperceptible and 200ms provides smoother visual feedback.
- Easing curves use Material Design standard curves. `--ease-spring` adds a slight overshoot for playful interactions (e.g., toast entrance).

**Acceptance Criteria:**
- [x] 5 duration tokens and 5 easing tokens defined
- [x] `prefers-reduced-motion` resets all durations to 0ms
- [x] Existing `global.css` reduced-motion rule preserved as safety net

---

### Unit 6: `styles/tokens/radius.css`

**File:** `platform/apps/web/src/styles/tokens/radius.css`

```css
/* ── Border Radius Tokens ── */

:root {
  /* Scale */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-circle: 50%;
  --radius-pill: 999px;
}
```

**Implementation Notes:**
- All 3 existing radius tokens move here unchanged.
- `--radius-xl`, `--radius-circle`, and `--radius-pill` are new. `--radius-circle` replaces `border-radius: 50%` (used 5 times for avatars). `--radius-pill` replaces `border-radius: 999px` (1 usage for pill buttons).

**Acceptance Criteria:**
- [x] All 3 existing radius tokens present with identical values
- [x] `--radius-xl`, `--radius-circle`, `--radius-pill` added

---

### Unit 7: Update `global.css`

**File:** `platform/apps/web/src/styles/global.css`

Replace the `:root` token block with `@import` statements and keep everything else.

```css
/* ── Design System Tokens ── */

@import "./tokens/color.css";
@import "./tokens/typography.css";
@import "./tokens/spacing.css";
@import "./tokens/elevation.css";
@import "./tokens/motion.css";
@import "./tokens/radius.css";

/* Backwards-compat aliases (remove when consumers migrate) */
:root {
  --shadow-dropdown: var(--shadow-md);
}

/* ── Base Reset ── */

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ... rest of global.css unchanged from line 84 onward ... */
```

**Implementation Notes:**
- `@import` order matters: tokens must load before they're referenced. Color first (no deps), then typography, spacing, elevation (references no other tokens), motion, radius.
- The `--shadow-dropdown` alias in a minimal `:root` block preserves backwards compatibility for the one existing reference. This alias is removed during the hardcoded values migration pass.
- Everything from line 74 onward in the current `global.css` (reset, document, typography, links, focus, utilities, animations, reduced-motion) stays unchanged.
- Vite resolves `@import` relative to the file and bundles them into a single stylesheet — no extra network requests in production.

**Acceptance Criteria:**
- [x] `@import` statements for all 6 token files
- [x] No `:root` token definitions remain in `global.css` (only the alias)
- [x] All content from line 74+ of the original file preserved exactly
- [x] `--shadow-dropdown` alias present in compat `:root` block

---

### Unit 8: Update `__root.test.tsx` mock

**File:** `platform/apps/web/tests/unit/routes/__root.test.tsx`

The existing test mocks `global.css?url`. Since `global.css` now uses `@import`, verify the mock still works — it should, because the mock replaces the entire URL import with a string. No CSS parsing happens in tests.

```typescript
// Existing mock — should continue working unchanged
vi.mock("../../../src/styles/global.css?url", () => ({
  default: "global.css",
}));
```

**Acceptance Criteria:**
- [x] Existing `__root.test.tsx` passes without modification

---

## Implementation Order

1. **Create `styles/tokens/` directory**
2. **Units 1-6** (token files) — can be created in parallel, no interdependencies
3. **Unit 7** (`global.css` update) — depends on all token files existing
4. **Unit 8** (test verification) — depends on Unit 7

## Testing

### Visual Regression: Manual Verification

Token restructuring produces no visual changes. The test approach is:

1. **Build succeeds:** `bun run --filter @snc/web build` completes without errors (Vite resolves all `@import` statements)
2. **Existing tests pass:** `bun run --filter @snc/web test` — confirms `__root.test.tsx` and all other tests still work
3. **Dev server renders:** `pm2 restart web` + load the home page, a creator page, and the admin playout page (the three areas with the most token usage). Verify no visual changes.
4. **Previously-broken tokens resolve:** Check that components using `--color-primary`, `--color-warning`, `--shadow-sm` now render correctly (they previously fell back to initial/fallback values).

### Automated: Token File Structure

A lightweight check that can run in CI to prevent token files from drifting:

**File:** `platform/apps/web/tests/unit/styles/token-files.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const TOKENS_DIR = resolve(import.meta.dirname, "../../../src/styles/tokens");
const GLOBAL_CSS = resolve(import.meta.dirname, "../../../src/styles/global.css");

const EXPECTED_TOKEN_FILES = [
  "color.css",
  "typography.css",
  "spacing.css",
  "elevation.css",
  "motion.css",
  "radius.css",
];

describe("design token files", () => {
  it("all expected token files exist", () => {
    for (const file of EXPECTED_TOKEN_FILES) {
      expect(existsSync(resolve(TOKENS_DIR, file)), `${file} should exist`).toBe(true);
    }
  });

  it("global.css imports all token files", () => {
    const globalCss = readFileSync(GLOBAL_CSS, "utf-8");
    for (const file of EXPECTED_TOKEN_FILES) {
      expect(globalCss).toContain(`@import "./tokens/${file}"`);
    }
  });

  it("global.css has no :root token definitions except aliases", () => {
    const globalCss = readFileSync(GLOBAL_CSS, "utf-8");
    // Extract all :root blocks
    const rootBlocks = globalCss.match(/:root\s*\{[^}]+\}/g) ?? [];
    for (const block of rootBlocks) {
      // Each property in a :root block should reference var() (alias) not a literal value
      const properties = block.match(/--[\w-]+:\s*[^;]+/g) ?? [];
      for (const prop of properties) {
        const [name, value] = prop.split(/:\s*/) as [string, string];
        expect(value.trim()).toMatch(
          /^var\(/,
          `${name} in global.css :root should be an alias (var() reference), not a literal value. Move literal definitions to token files.`,
        );
      }
    }
  });

  it("each token file defines only :root custom properties", () => {
    for (const file of EXPECTED_TOKEN_FILES) {
      const content = readFileSync(resolve(TOKENS_DIR, file), "utf-8");
      // Strip comments and @media blocks for this check
      const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, "");
      const withoutMedia = withoutComments.replace(/@media[^{]+\{[^}]*:root\s*\{[^}]*\}[^}]*\}/g, "");
      // Only :root selectors should remain (no element selectors, no classes)
      const selectors = withoutMedia.match(/[^@\s{][^{]*(?=\s*\{)/g) ?? [];
      for (const selector of selectors) {
        expect(selector.trim()).toBe(":root");
      }
    }
  });

  it("motion.css includes prefers-reduced-motion reset", () => {
    const motion = readFileSync(resolve(TOKENS_DIR, "motion.css"), "utf-8");
    expect(motion).toContain("prefers-reduced-motion: reduce");
    expect(motion).toContain("--duration-normal: 0ms");
  });
});
```

## Verification Checklist

```bash
# 1. Build succeeds (Vite resolves @import)
bun run --filter @snc/web build

# 2. All existing tests pass
bun run --filter @snc/web test

# 3. New token structure test passes
bun run --filter @snc/web test -- tests/unit/styles/token-files.test.ts

# 4. Dev server renders correctly
pm2 restart web
# Manual: load /, /creators, /admin/playout — verify no visual changes
```
