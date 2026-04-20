---
id: feature-mobile-nav-redesign-implementation
kind: feature
stage: review
tags: [design-system, ux-polish]
release_binding: null
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: mobile-nav-redesign
---

# Mobile Nav Redesign — Implementation

## Tasks

- [ ] **`--tab-bar-height` token** — 56px mobile / 0px desktop
- [ ] **Content padding** — `.main-content` includes `--tab-bar-height`
- [ ] **GlobalPlayer stacking** — bottom offsets + imperative padding removed
- [ ] **Upload indicator stacking** — bottom offset
- [ ] **Bottom tab bar** — `bottom-tab-bar.tsx` (Home, Feed, Live, Creators), z-150
- [ ] **UserMenu visibility** — visible at all widths
- [ ] **Root layout mount** — `<BottomTabBar />` in `__root.tsx`
- [ ] **NavBar cleanup** — `<MobileMenu>` removed
- [ ] **Delete mobile-menu chain** — 6 files deleted (component, CSS, hooks, tests)
- [ ] **Responsive cleanup** — zero `max-width` media queries remain

---

## Overview

Replace the hamburger menu with a fixed bottom tab bar on mobile. Make UserMenu visible at all widths. Delete the mobile-menu component and its hook chain. Integrate the tab bar into the existing fixed-bottom stacking model (GlobalPlayer, MiniUploadIndicator) via a new `--tab-bar-height` CSS variable.

---

## Implementation Units

### Unit 1: `--tab-bar-height` Token

**File**: `apps/web/src/styles/tokens/spacing.css`

Add after `--mini-upload-height: 0px;`:

```css
  --tab-bar-height: 56px;
```

Add a media query after the `:root` block:

```css
@media (min-width: 768px) {
  :root {
    --tab-bar-height: 0px;
  }
}
```

The 56px value accounts for 44px touch target (WCAG 2.2 SC 2.5.8) + 12px safe area.

**Acceptance Criteria**:

- [ ] `--tab-bar-height` is `56px` by default
- [ ] `--tab-bar-height` is `0px` at `min-width: 768px`

---

### Unit 2: Stacking Integration — Content Padding

**File**: `apps/web/src/styles/global.css`

Update `.main-content` padding-bottom to include `--tab-bar-height`:

```css
/* After */
padding-bottom: calc(var(--space-section-fluid) + var(--tab-bar-height) + var(--mini-player-height) + var(--mini-upload-height));
```

**Acceptance Criteria**:

- [ ] `.main-content` padding-bottom sums all four variables

---

### Unit 3: Stacking Integration — GlobalPlayer

**File**: `apps/web/src/components/media/global-player.module.css`

Update `.collapsedBar` bottom:

```css
/* After */
.collapsedBar {
  position: fixed;
  bottom: var(--tab-bar-height, 0px);
  /* ... */
}
```

Update `.collapsedOverlay` bottom (both base and media query):

```css
/* After — base (mobile) */
.collapsedOverlay {
  bottom: calc(var(--space-md) + var(--mini-upload-height, 0px) + var(--tab-bar-height, 0px));
  /* ... */
}

/* After — desktop (--tab-bar-height is 0px at 768px+, but include for safety) */
@media (min-width: 768px) {
  .collapsedOverlay {
    bottom: calc(var(--space-lg) + var(--mini-upload-height, 0px) + var(--tab-bar-height, 0px));
  }
}
```

**File**: `apps/web/src/components/media/global-player.tsx`

Remove the imperative `document.body.style.paddingBottom` lines. The CSS variable chain in `.main-content` already handles this.

```typescript
// After (remove paddingBottom lines)
useEffect(() => {
  if (presentation === "collapsed") {
    const height = state.media?.contentType === "audio" ? "64px" : "0px";
    document.body.style.setProperty("--mini-player-height", height);
  } else {
    document.body.style.removeProperty("--mini-player-height");
  }
  return () => {
    document.body.style.removeProperty("--mini-player-height");
  };
}, [presentation, state.media?.contentType]);
```

**Acceptance Criteria**:

- [ ] `.collapsedBar` bottom is `var(--tab-bar-height, 0px)` (shifts up on mobile)
- [ ] `.collapsedOverlay` bottom includes `--tab-bar-height` in both base and desktop media query
- [ ] Imperative `paddingBottom` on `document.body` removed from `global-player.tsx`
- [ ] `--mini-player-height` CSS variable logic unchanged

---

### Unit 4: Stacking Integration — MiniUploadIndicator

**File**: `apps/web/src/components/upload/mini-upload-indicator.module.css`

Update `.indicator` bottom:

```css
/* After */
.indicator {
  position: fixed;
  bottom: var(--tab-bar-height, 0px);
  /* ... */
}
```

**Acceptance Criteria**:

- [ ] Upload indicator sits above the tab bar on mobile

---

### Unit 5: Bottom Tab Bar Component

**File**: `apps/web/src/components/layout/bottom-tab-bar.tsx` *(new)*

```typescript
import { Link, useRouterState } from "@tanstack/react-router";
import type React from "react";
import { Home, Rss, Radio, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import styles from "./bottom-tab-bar.module.css";

interface TabItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly exact?: boolean;
}

const TAB_ITEMS: readonly TabItem[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/feed", label: "Feed", icon: Rss },
  { to: "/live", label: "Live", icon: Radio },
  { to: "/creators", label: "Creators", icon: Users },
];

/** Fixed bottom tab bar for mobile navigation. Hidden on desktop (≥768px). */
export function BottomTabBar(): React.ReactElement {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <nav
      className={styles.tabBar}
      aria-label="Primary navigation"
    >
      {TAB_ITEMS.map((item) => {
        const isActive = item.exact
          ? currentPath === item.to
          : currentPath === item.to || currentPath.startsWith(`${item.to}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.to}
            to={item.to}
            className={isActive ? styles.tabActive : styles.tab}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon size={20} aria-hidden="true" />
            <span className={styles.tabLabel}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

**File**: `apps/web/src/components/layout/bottom-tab-bar.module.css` *(new)*

```css
/* ── Tab Bar Container ── */

.tabBar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--tab-bar-height);
  z-index: 150;
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: var(--color-bg-elevated);
  border-top: 1px solid var(--color-border);
}

@media (min-width: 768px) {
  .tabBar {
    display: none;
  }
}

/* ── Tab Item ── */

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  flex: 1;
  height: 100%;
  text-decoration: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: 500;
  transition: color var(--duration-fast) var(--ease-default);
  -webkit-tap-highlight-color: transparent;
}

.tab:hover {
  color: var(--color-text);
}

/* ── Active State ── */

.tabActive {
  composes: tab;
  color: var(--color-accent);
}

/* ── Label ── */

.tabLabel {
  line-height: 1;
}
```

**Implementation Notes**:

- `TAB_ITEMS` is a hardcoded constant, not derived from `NAV_LINKS`. The tab bar is the 4 most important destinations — not the full nav list.
- Home uses `exact: true` for path matching — otherwise every page would match `/`.
- z-index 150 — below GlobalPlayer (200) and MiniUploadIndicator (200), above NavBar (100).
- `-webkit-tap-highlight-color: transparent` — removes the default tap highlight on iOS.
- `display: none` at 768px+ — the desktop nav links handle navigation.

**Acceptance Criteria**:

- [ ] Tab bar renders 4 items: Home, Feed, Live, Creators
- [ ] Active tab highlighted with accent color and `aria-current="page"`
- [ ] Hidden on desktop (≥768px)
- [ ] z-index 150 (below player, above nav)
- [ ] Tab bar height matches `--tab-bar-height` (56px)
- [ ] `aria-label="Primary navigation"` on nav element

---

### Unit 6: UserMenu Mobile Visibility

**File**: `apps/web/src/components/layout/user-menu.module.css`

The responsive overhaul set `.loggedOut`, `.avatarSkeleton`, and `.avatarButton` to `display: none` as base with `display: flex`/`display: block` at md+. Undo this — these should be visible at all widths now that the hamburger menu is gone and the tab bar handles navigation.

```css
/* After */
.loggedOut {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.avatarButton {
  display: flex;
  align-items: center;
  /* ... */
}

/* Remove display: none from .avatarSkeleton base rule */
/* Remove the entire @media (min-width: 768px) block at the end of the file */
```

**Acceptance Criteria**:

- [ ] `.loggedOut` is `display: flex` at all widths
- [ ] `.avatarButton` is `display: flex` at all widths
- [ ] `.avatarSkeleton` has no explicit `display` (block by default)
- [ ] No responsive media query remains in `user-menu.module.css`

---

### Unit 7: Root Layout — Mount Tab Bar

**File**: `apps/web/src/routes/__root.tsx`

Add import:

```typescript
import { BottomTabBar } from "../components/layout/bottom-tab-bar.js";
```

In `AppShell`, add `<BottomTabBar />` after `<MiniUploadIndicator />`:

```tsx
// After
<MiniUploadIndicator />
<BottomTabBar />
{!isLiveLayout && !isTheater && <Footer />}
```

The tab bar renders unconditionally — its CSS handles the `display: none` at ≥768px.

**Acceptance Criteria**:

- [ ] `BottomTabBar` rendered as peer to `NavBar` in `__root.tsx`
- [ ] Renders on all pages (CSS handles desktop hide)

---

### Unit 8: NavBar — Remove MobileMenu

**File**: `apps/web/src/components/layout/nav-bar.tsx`

Remove the `MobileMenu` import and its JSX from the `right` div:

```tsx
// After
<div className={styles.right}>
  {user && <NotificationBell />}
  <UserMenu {...(serverAuth !== undefined ? { serverAuth } : {})} />
</div>
```

The `currentPath` variable is still needed by NavLinkItem — don't remove it. The `serverAuth` prop is still consumed by `UserMenu` — don't remove the prop.

**Acceptance Criteria**:

- [ ] `MobileMenu` no longer imported or rendered in NavBar
- [ ] `UserMenu` and `NotificationBell` remain in the `right` div

---

### Unit 9: Delete Mobile Menu Chain

Delete these files:

| File | What |
|------|------|
| `apps/web/src/components/layout/mobile-menu.tsx` | Component |
| `apps/web/src/components/layout/mobile-menu.module.css` | Styles |
| `apps/web/src/hooks/use-menu-toggle.ts` | Hook |
| `apps/web/src/hooks/use-dismiss.ts` | Hook |
| `apps/web/tests/unit/components/mobile-menu.test.tsx` | Component test |
| `apps/web/tests/unit/hooks/use-menu-toggle.test.ts` | Hook test |

`tests/helpers/auth-mock.ts` references `mobile-menu` in a comment — update the comment to remove the reference.

**Acceptance Criteria**:

- [ ] All 6 files deleted
- [ ] No remaining imports of `mobile-menu`, `use-menu-toggle`, or `use-dismiss`
- [ ] Build succeeds without these files
- [ ] Stale comment in `auth-mock.ts` updated

---

### Unit 10: Responsive Cleanup Verification

After Unit 9 deletes `mobile-menu.module.css`, verify remaining `max-width` media queries:

```bash
grep -r "@media.*max-width" platform/apps/web/src --include="*.css" --include="*.module.css"
```

The only remaining file should be `hero-section.module.css` (which was deferred from the responsive overhaul). If the landing page redesign already rewrote the hero section, it may be gone. If it still has `max-width`, convert it to mobile-first.

**Acceptance Criteria**:

- [ ] No `@media (max-width: ...)` queries remain in any `.css` file under `apps/web/src/`

---

## Implementation Order

1. Unit 1: Token — `--tab-bar-height` (foundation for everything)
2. Unit 2: Content padding — `.main-content` includes new variable
3. Unit 3: GlobalPlayer stacking — bottom offsets + remove imperative padding
4. Unit 4: Upload indicator stacking — bottom offset
5. Unit 5: BottomTabBar component — new component + CSS
6. Unit 6: UserMenu visibility — undo responsive hide
7. Unit 7: Root layout — mount BottomTabBar
8. Unit 8: NavBar — remove MobileMenu
9. Unit 9: Delete chain — remove files
10. Unit 10: Cleanup verification — check for remaining max-width

**Parallelization**: Units 5-6 are independent of each other and of Units 2-4. Units 7-8 depend on Units 5 and 6 respectively. Unit 9 depends on Unit 8. Unit 10 depends on Unit 9.

---

## Testing

### Component Test: `apps/web/tests/unit/components/layout/bottom-tab-bar.test.tsx` *(new)*

Key test cases:
- Renders 4 tab items — verify Home, Feed, Live, Creators links present
- Home tab active on `/` — mock `useRouterState` to return `{ location: { pathname: "/" } }`, verify Home has `aria-current="page"`, others don't
- Feed tab active on `/feed` — mock pathname `/feed`, verify Feed has `aria-current`
- Feed tab active on sub-path `/feed?type=video` — verify prefix matching works
- Creators tab active on `/creators/some-id` — verify prefix matching
- No tab active on unmatched path — pathname `/settings`, no `aria-current` on any tab
- Links have correct href — verify `href` attributes: `/`, `/feed`, `/live`, `/creators`

### Updated Tests

- `nav-bar.test.tsx` — if it references MobileMenu, update to remove MobileMenu assertions
- `__root.test.tsx` — if it references AppShell's children, add BottomTabBar to expected rendered components

---

## Verification Checklist

```bash
# Build (catches import errors from deletions, CSS syntax)
bun run --filter @snc/web build

# Run all web tests
bun run --filter @snc/web test

# Verify no max-width media queries remain
grep -r "@media.*max-width" platform/apps/web/src --include="*.css" --include="*.module.css"

# Verify deleted files are gone
ls platform/apps/web/src/components/layout/mobile-menu.* 2>/dev/null && echo "FAIL: mobile-menu files still exist" || echo "OK"
ls platform/apps/web/src/hooks/use-menu-toggle.ts 2>/dev/null && echo "FAIL: use-menu-toggle still exists" || echo "OK"
ls platform/apps/web/src/hooks/use-dismiss.ts 2>/dev/null && echo "FAIL: use-dismiss still exists" || echo "OK"

# Verify no stale imports
grep -r "mobile-menu\|useMenuToggle\|useDismiss\|use-menu-toggle\|use-dismiss" platform/apps/web/src --include="*.ts" --include="*.tsx"
```
