---
id: feature-design-system-foundation-lucide-react-integration
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

# Design System Foundation — Lucide React Integration (Phase 4)

## Overview

Install `lucide-react` and perform a first-pass icon integration: replace existing inline SVGs, add icons to nav links, and replace text close buttons in the new Ark UI primitives. Remaining icon additions (user menu items, empty states, mobile hamburger, etc.) are parked in the backlog for incremental adoption.

**Package:** `lucide-react` (ISC license, 1500+ tree-shakeable React component icons)

**Icon sizing convention:**
- Inline with text (nav labels, buttons): `size={16}` or `size={18}`
- Standalone (notification bell, status indicators): `size={20}`
- All decorative icons: `aria-hidden="true"`

---

## Implementation Units

### Unit 0: Install `lucide-react`

```bash
bun add --filter @snc/web lucide-react
```

**Acceptance Criteria:**
- [x] `lucide-react` in `apps/web/package.json` dependencies
- [x] `bun run --filter @snc/web build` succeeds

---

### Unit 1: Replace Notification Bell Inline SVG

**File:** `platform/apps/web/src/components/notification-bell.tsx` (modify)

Replace the inline SVG (lines 120-133) with the Lucide `Bell` component:

```tsx
// Add import at top:
import { Bell } from "lucide-react";

// Replace the <svg>...</svg> block (lines 120-133) with:
<Bell size={20} aria-hidden="true" />
```

**Implementation Notes:**
- The existing SVG is already a bell shape matching Lucide's `Bell` icon — visual change will be minimal.
- Keep the existing `aria-label` on the parent `<button>` (line 115). The icon is decorative (`aria-hidden="true"`).
- The badge (`<span className={styles.badge}>`) stays as-is — it overlays the icon.

**Acceptance Criteria:**
- [x] Inline SVG removed
- [x] `Bell` from `lucide-react` renders at size 20
- [x] Badge count still displays over the icon
- [x] `aria-label` on button preserved

---

### Unit 2: Replace Content Card Lock Icons

**File:** `platform/apps/web/src/components/content/content-card.tsx` (modify)

Replace both lock SVGs with the Lucide `Lock` component:

```tsx
// Add import at top:
import { Lock } from "lucide-react";

// Replace first SVG (lines 50-59, inside .lockOverlay span) with:
<Lock size={16} aria-hidden="true" />

// Replace second SVG (lines 70-72, inside .lockInline span) with:
<Lock size={14} aria-hidden="true" />
```

**Implementation Notes:**
- Two lock icons in the same file: one for thumbnail overlay (16px), one for inline no-thumbnail variant (14px).
- The `aria-label="Subscribers only"` on the parent `<span>` provides the accessible name. The icon is decorative.
- Lucide's `Lock` uses `stroke` (not `fill`), which differs from the current custom SVG that uses `fill="currentColor"`. The visual will be slightly different — an outlined lock vs. a filled lock. This is acceptable and consistent with the Lucide line-icon style.

**Acceptance Criteria:**
- [x] Both inline SVGs removed
- [x] `Lock` from `lucide-react` renders at correct sizes (16px and 14px)
- [x] `aria-label` on parent spans preserved

---

### Unit 3: Replace Checkbox Checkmark

**File:** `platform/apps/web/src/components/ui/checkbox.tsx` (modify)

Replace the private `CheckIcon` function with Lucide's `Check`:

```tsx
// Add import at top:
import { Check } from "lucide-react";

// Remove the private CheckIcon function (lines 30-36)

// In the Checkbox component, replace <CheckIcon /> with:
<Check size={12} aria-hidden="true" />
```

**Implementation Notes:**
- The existing `CheckIcon` is a 12x12 SVG with a checkmark path — Lucide's `Check` is the same shape.
- `strokeWidth` defaults to 2 in Lucide, matching the existing SVG's `strokeWidth="2"`.

**Acceptance Criteria:**
- [x] Private `CheckIcon` function removed
- [x] `Check` from `lucide-react` renders at size 12
- [x] Checked state visually identical

---

### Unit 4: Replace Close Buttons in Dialog and Toast

**File:** `platform/apps/web/src/components/ui/toast.tsx` (modify)

```tsx
// Add import at top:
import { X } from "lucide-react";

// Replace &times; with:
<ArkToast.CloseTrigger className={styles.close}>
  <X size={16} aria-hidden="true" />
</ArkToast.CloseTrigger>
```

**File:** `platform/apps/web/src/components/ui/dialog.tsx`

The dialog's `DialogCloseTrigger` doesn't have default content — consumers provide their own children. Document the pattern for consumers:

```tsx
// Consumer usage:
import { X } from "lucide-react";
<DialogCloseTrigger>
  <X size={18} aria-hidden="true" />
</DialogCloseTrigger>
```

**Acceptance Criteria:**
- [x] Toast close button uses `X` icon instead of `×` character
- [x] Icon renders at 16px inside the close button
- [x] Close functionality unchanged

---

### Unit 5: Add Icons to Navigation Links

**File:** `platform/apps/web/src/config/navigation.ts` (modify)

Add an `icon` field to the `NavLink` interface and populate it for each link:

```tsx
// Add import at top:
import type { LucideIcon } from "lucide-react";

// Update NavLink interface:
export interface NavLink {
  readonly to: string;
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly feature?: FeatureFlag;
  readonly disabled?: boolean;
  readonly external?: boolean;
  readonly role?: Role;
}

// Update ALL_NAV_LINKS — import icons at top:
import { Rss, Users, Radio, Mic, ShoppingBag, Leaf } from "lucide-react";

const ALL_NAV_LINKS: readonly Omit<NavLink, "disabled">[] = [
  { to: "/feed", label: "Feed", icon: Rss },
  { to: "/creators", label: "Creators", icon: Users },
  { to: "/live", label: "Live", icon: Radio },
  { to: "/studio", label: "Studio", feature: "booking", icon: Mic },
  { to: "/merch", label: "Merch", feature: "merch", icon: ShoppingBag },
  { to: "/emissions", label: "Emissions", feature: "emissions", icon: Leaf },
] as const;
```

**File:** `platform/apps/web/src/components/layout/nav-link-item.tsx` (modify)

Render the icon before the label text:

```tsx
{link.icon && <link.icon size={16} aria-hidden="true" />}
{link.label}
```

**File:** `platform/apps/web/src/components/layout/nav-bar.module.css` (modify)

```css
/* Add to the existing .navLink rule: */
.navLink {
  /* ... existing styles ... */
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}
```

**Implementation Notes:**
- `LucideIcon` is the type for Lucide React component references — used for the `icon` field type.
- Icons are optional (`icon?`) so links without icons still work.
- `<link.icon size={16} />` — JSX supports dynamic component rendering from a variable when it's PascalCase or a direct prop reference.
- The `as const` assertion on `ALL_NAV_LINKS` may need to be removed or the array typed differently since the objects now include non-primitive `icon` values. Use `satisfies` instead if TypeScript complains.

**Acceptance Criteria:**
- [x] `NavLink` interface has optional `icon` field typed as `LucideIcon`
- [x] All 6 nav links have icons assigned
- [x] Icons render at 16px before label text
- [x] Icons have `aria-hidden="true"`
- [x] Icons and labels align vertically via flexbox + gap
- [x] Feature-gated links still work correctly
- [x] Mobile menu nav links also show icons (they use the same `NavLinkItem` component)

---

## Implementation Order

1. **Unit 0:** Install `lucide-react`
2. **Units 1-4:** SVG replacements and close button updates (independent, can be parallel)
3. **Unit 5:** Navigation icons (independent of Units 1-4)

## Verification Checklist

```bash
# 1. Install dependency
bun add --filter @snc/web lucide-react

# 2. Build succeeds
bun run --filter @snc/web build

# 3. All tests pass
bun run --filter @snc/web test

# 4. Dev server renders correctly
pm2 restart web
# Manual: check nav icons, bell icon, lock icons, toast close, checkbox check
```
