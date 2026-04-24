---
id: epic-mobile-nav-redesign
kind: epic
stage: done
tags: [design-system, ux-polish]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-20
related_decisions: []
related_designs: []
parent: null
---

# Mobile Nav Redesign

> **Epic sign-off (2026-04-20):** both children shipped and bound to 0.3.0.
> - `mobile-nav-redesign-implementation` — bottom tab bar with Home/Feed/Live/Creators, UserMenu visible at all widths, mobile-menu + useMenuToggle + useDismiss chain fully deleted.
> - `mobile-nav-overflow-access` — 5th "More" tab opening an overflow sheet with Studio/Merch/Emissions, scoped mid-review when the gap surfaced that the 4-tab bar left those routes mobile-unreachable.

Replace the hamburger menu with a fixed bottom tab bar on mobile. Make UserMenu visible at all widths. Delete the mobile-menu component and its hook chain. Integrate the tab bar into the existing fixed-bottom stacking model (GlobalPlayer, MiniUploadIndicator) via a new `--tab-bar-height` CSS variable.

Research: NNG 2025 → bottom tabs +65% DAU, +70% session time vs hamburger; hamburger reduces discoverability 20%+, increases task time 39% desktop / 15% mobile.

---

## Vision

Replace the hamburger + sheet overlay with a fixed bottom tab bar — always-visible primary navigation on mobile. UserMenu (avatar/auth) becomes visible on mobile in the top nav bar. The hamburger menu, `useMenuToggle`, and `useDismiss` hooks are deleted entirely.

---

## Current State

### DOM Structure (`__root.tsx`)

```
<NavBar />                    ← sticky top, z-100
<main class="main-content">  ← padding-bottom accounts for player + upload
  <GlobalPlayer />            ← z-200 (fixed when collapsed)
  <Outlet />
</main>
<MiniUploadIndicator />       ← z-200, fixed bottom
<Footer />
```

### Fixed-Bottom Element Stack

| Element | Position | Z-Index | Height | CSS Variable |
|---------|----------|---------|--------|--------------|
| NavBar | sticky top | 100 | 64px | `--nav-height` |
| GlobalPlayer `.collapsedBar` (audio) | fixed bottom: 0 | 200 | 64px | `--mini-player-height` |
| GlobalPlayer `.collapsedOverlay` (video) | fixed bottom-right | 200 | auto (16:9) | — |
| MiniUploadIndicator | fixed bottom: 0 | 200 | 48px | `--mini-upload-height` |

### CSS Variable Chain

Variables set imperatively on `document.body` by React components:
- `--mini-player-height`: `0px` default, `64px` when audio playing collapsed
- `--mini-upload-height`: `0px` default, `48px` when uploads active

Consumed by `.main-content` padding-bottom:
```css
padding-bottom: calc(var(--space-section-fluid) + var(--mini-player-height) + var(--mini-upload-height));
```

### Mobile Menu Consumer Chain

```
mobile-menu.tsx → useMenuToggle → useDismiss
```

All three are safe to delete:
- `useDismiss` — only imported by `use-menu-toggle.ts`
- `useMenuToggle` — only imported by `mobile-menu.tsx`
- `mobile-menu.tsx` — only imported by `nav-bar.tsx`

### UserMenu Current State

The responsive overhaul set these to `display: none` base with `display: flex` at md+:
- `.avatarButton`
- `.avatarSkeleton`
- `.loggedOut`

This needs to be undone — these elements should be visible at all widths.

---

## Architectural Decisions

### 1. Tab Bar Items

4 fixed items — not derived from `NAV_LINKS`:

| Item | Path | Icon | Match |
|------|------|------|-------|
| Home | `/` | `Home` | exact `/` |
| Feed | `/feed` | `Rss` | starts with `/feed` |
| Live | `/live` | `Radio` | starts with `/live` |
| Creators | `/creators` | `Users` | starts with `/creators` |

**Why not use `NAV_LINKS`:** The tab bar has a fundamentally different purpose — it's the 4 most important destinations, not the full nav list. `NAV_LINKS` includes feature-gated items (Studio, Merch, Emissions) and role-gated items that don't belong in primary mobile nav. Hardcoding 4 items is clearer than filtering `NAV_LINKS` down.

**Why Home is added:** On desktop, the S/NC logo is the home link. On mobile with a hamburger, the logo is still accessible. With a bottom tab bar, adding an explicit Home tab provides the clearest mobile navigation pattern.

### 2. DOM Placement

**Peer to NavBar in `__root.tsx`**, not a child of NavBar:

```tsx
{!isTheater && <NavBar />}
<main id="main-content" className="main-content">
  {/* ... */}
</main>
<MiniUploadIndicator />
{!isTheater && <Footer />}
<BottomTabBar />              ← NEW: after everything, fixed bottom
```

Rationale: the tab bar is visually and semantically a peer to the top nav, not part of it. It reads `currentPath` from `useRouterState()` directly.

### 3. Stacking Model

New z-index layer: **z-150** for the tab bar.

```
z-200  GlobalPlayer (collapsed) + MiniUploadIndicator
z-150  BottomTabBar
z-100  NavBar
```

Everything at z-200 shifts up by `--tab-bar-height`:

| Element | Current `bottom` | New `bottom` |
|---------|-----------------|--------------|
| Tab bar | — | `0` |
| Audio bar (`.collapsedBar`) | `0` | `var(--tab-bar-height, 0px)` |
| Video overlay (`.collapsedOverlay`) | `calc(--space-md + --mini-upload-height)` | `calc(--space-md + --mini-upload-height + --tab-bar-height)` |
| Upload indicator | `0` | `var(--tab-bar-height, 0px)` |

### 4. `--tab-bar-height` as CSS-Only Variable

Unlike `--mini-player-height` (set by JS because it depends on playback state), the tab bar's presence is purely viewport-determined. Set via CSS:

```css
:root {
  --tab-bar-height: 56px;
}

@media (min-width: 768px) {
  :root {
    --tab-bar-height: 0px;
  }
}
```

This is simpler than a React effect and correct — the tab bar is always rendered on mobile, never on desktop.

### 5. Content Padding Update

`.main-content` padding-bottom becomes:

```css
padding-bottom: calc(
  var(--space-section-fluid)
  + var(--tab-bar-height, 0px)
  + var(--mini-player-height)
  + var(--mini-upload-height)
);
```

The GlobalPlayer's imperative `document.body.style.paddingBottom = "64px"` is removed entirely — the CSS variable chain in `.main-content` already handles this.

### 6. A11y

- `role="navigation"` with `aria-label="Primary navigation"` (distinct from the top nav's `aria-label="Main navigation"`)
- Active tab: `aria-current="page"` attribute
- Not using `role="tablist"` — these are navigation links, not tabs that switch panels

### 7. What Gets Deleted

| File | Reason |
|------|--------|
| `components/layout/mobile-menu.tsx` | Replaced by tab bar |
| `components/layout/mobile-menu.module.css` | Styles for deleted component |
| `hooks/use-menu-toggle.ts` | Only consumer was mobile-menu |
| `hooks/use-dismiss.ts` | Only consumer was use-menu-toggle |
| `tests/.../mobile-menu.test.tsx` | Tests for deleted component |

NavBar changes: remove `MobileMenu` import and `<MobileMenu>` JSX.

### 8. Responsive Overhaul Cleanup

After `mobile-menu.module.css` is deleted, check remaining `max-width` media queries. The only other file was `hero-section.module.css` which was deferred from the responsive overhaul — but the landing page redesign may have changed it. Verify and clean up any remaining desktop-first queries.

---

## Key File References

| File | Role |
|------|------|
| `apps/web/src/routes/__root.tsx` | Root layout — where tab bar mounts |
| `apps/web/src/components/layout/nav-bar.tsx` | Top nav — remove MobileMenu |
| `apps/web/src/components/layout/mobile-menu.tsx` | DELETE |
| `apps/web/src/components/layout/mobile-menu.module.css` | DELETE |
| `apps/web/src/hooks/use-menu-toggle.ts` | DELETE |
| `apps/web/src/hooks/use-dismiss.ts` | DELETE |
| `apps/web/src/components/layout/user-menu.module.css` | Remove responsive hide |
| `apps/web/src/components/media/global-player.module.css` | Add `--tab-bar-height` to bottom offsets |
| `apps/web/src/components/media/global-player.tsx` | Remove imperative paddingBottom |
| `apps/web/src/components/upload/mini-upload-indicator.module.css` | Add `--tab-bar-height` to bottom |
| `apps/web/src/styles/tokens/spacing.css` | Add `--tab-bar-height` token |
| `apps/web/src/styles/global.css` | Update `.main-content` padding-bottom |

---

## Implementation Pitfalls

- **GlobalPlayer imperative padding:** The player sets `document.body.style.paddingBottom = "64px"` directly. This bypasses the CSS variable chain and would fight with `--tab-bar-height`. Remove the imperative padding entirely since `.main-content` already sums all three variables.
- **UserMenu visibility undo:** The responsive overhaul *just* set these to `display: none` base. The nav redesign undoes this. The design doc specifies the exact final state so the implementer doesn't get confused by the recent change.
- **`hero-section.module.css` max-width cleanup:** After mobile-menu deletion, verify whether `hero-section.module.css` still has `max-width` media queries. The landing page redesign restructured the hero — the old responsive rules may already be gone.
- **Test cleanup:** `mobile-menu.test.tsx` deletion is straightforward. But check if any other test files import from the deleted hooks or reference mobile-menu behavior.
