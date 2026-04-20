---
id: epic-design-system-foundation
kind: epic
stage: implementing
tags: [design-system, platform]
release_binding: null
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Design System Foundation

Foundation work for the UI/UX system. Token restructuring, icon system, first headless primitives (Ark UI), and shared pattern components. Reference: `.memory/research/ui-ux-system-plan.md`.

> Ark UI component migration (dialogs, menus, popovers, selects, dismiss-hook retirement) split to release-0.2.6 — "Design System Adoption".

## Child Features

- `design-system-foundation-token-restructuring` — Phase 0 (done, bound to 0.2.1)
- `design-system-foundation-ark-ui-primitives` — Phase 1 (done, bound to 0.2.1)
- `design-system-foundation-shared-component-conventions` — Phase 2 (review, not yet bound)
- `design-system-foundation-lucide-react-integration` — Phase 4 (done, bound to 0.2.1)

Phase 3 (Responsive Overhaul) is scoped to release-0.2.7. Phases 5 and 6 are in backlog.

---

## Decisions Made

### Headless primitive library: Ark UI (`@ark-ui/react`)

MIT license. 45+ accessible components built on Zag.js state machines. Styling via `data-scope`/`data-part`/`data-state` HTML attributes — targets naturally in CSS Modules with attribute selectors or direct `className` props. No Tailwind dependency. React + Solid + Vue + Svelte.

Chosen over Radix (React-only, less CSS-Modules-natural), shadcn/ui (requires Tailwind), React Aria (heavier API). Lock-in risk is low — the visual layer is our CSS Modules, Ark UI is just the behavioral layer. Full comparison: `.memory/research/ui-ux-system-plan.md § Recommended Architecture`.

### Icon library: Lucide React (`lucide-react`)

ISC license (MIT-compatible). 1500+ icons as React components. Tree-shakeable — only icons you import ship in the bundle. Consistent 24x24 default with `size`/`color`/`strokeWidth` props.

### Token architecture: Split CSS custom property files

```
styles/tokens/
  color.css        — primitive + semantic colors, dark mode defaults
  typography.css   — families, sizes (fluid clamp), weights, line-heights, letter-spacing
  spacing.css      — scale (xs through 2xl) + semantic spacing
  elevation.css    — shadow scale (xs through xl) + named z-index layers
  motion.css       — duration tokens + easing curves + prefers-reduced-motion reset
  radius.css       — border radius scale
```

`global.css` imports all token files, keeps resets and base utility classes (`.sr-only`, `.skip-link`, `.content-grid`). Zero migration — existing `var()` references keep working. Full token category reference: `.memory/research/ui-ux-system-plan.md § Phased Roadmap → Phase 0`.

### Styled wrapper pattern for Ark UI components

Each shared primitive gets two files in `components/ui/`:

```tsx
// components/ui/dialog.tsx
import { Dialog as ArkDialog } from "@ark-ui/react/dialog";
import styles from "./dialog.module.css";

export function DialogRoot(props) { return <ArkDialog.Root {...props} />; }
export function DialogBackdrop() { return <ArkDialog.Backdrop className={styles.backdrop} />; }
export function DialogContent({ children, ...props }) {
  return (
    <ArkDialog.Positioner className={styles.positioner}>
      <ArkDialog.Content className={styles.content} {...props}>{children}</ArkDialog.Content>
    </ArkDialog.Positioner>
  );
}
export function DialogTitle(props) { return <ArkDialog.Title className={styles.title} {...props} />; }
export function DialogCloseTrigger(props) { return <ArkDialog.CloseTrigger className={styles.close} {...props} />; }
export const DialogTrigger = ArkDialog.Trigger;
```

```css
/* components/ui/dialog.module.css */
.backdrop {
  position: fixed;
  inset: 0;
  background: var(--overlay-lock);
  z-index: var(--z-overlay);
  animation: fadeIn var(--duration-normal) var(--ease-out);
}
.positioner {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}
.content {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  padding: var(--space-lg);
  max-width: min(90vw, 500px);
  animation: fadeIn var(--duration-normal) var(--ease-out);
}
```

This pattern: Ark UI handles behavior (focus trap, escape-to-close, ARIA). CSS Modules + tokens handle visual. Consumers import our wrapper, not Ark UI directly.

### Reduced motion strategy

Token reset — all `--duration-*` tokens go to 0ms under `prefers-reduced-motion: reduce`. Every component using motion tokens gets reduced motion automatically. No per-component media queries needed.

### z-index layers

Named tokens replacing scattered magic numbers:

```css
--z-dropdown: 100;
--z-sticky: 200;
--z-overlay: 300;
--z-modal: 400;
--z-toast: 500;
```

Current codebase uses: 10 (reaction picker), 50 (day popover), 100 (nav), 101 (demo banner), 150 (mobile overlay), 200 (dropdowns, global player). These map to the new layer system.

---

## What Each Phase Covers

### Token Restructuring (Phase 0)

**Files to create:** 6 token files in `styles/tokens/`
**Files to modify:** `global.css` (replace inline tokens with `@import` of token files)
**No component changes.** All existing `var()` references keep working because the property names don't change.

### Ark UI Primitives (Phase 1)

12 accessible wrapper components: Dialog, Toast, Tooltip, Menu, Tabs, Select, Popover, Field, Checkbox, Switch, Progress, Collapsible.

### Shared Pattern Components (Phase 2)

Button, FormField, Heading, Spinner, EmptyState — shared API vocabulary and conventions established in `design-system-foundation-shared-component-conventions`.

### Lucide React Integration (Phase 4)

Replace inline SVGs, add icons to nav links and Ark UI primitive close buttons.

---

## Implementation Order

1. **Token restructuring** — no deps, enables everything else
2. **Lucide React** — install + first icon replacements (independent of Ark UI)
3. **Dialog primitive** — first Ark UI component, establishes the wrapper pattern
4. **Toast primitive** — second Ark UI component, new capability
5. **Tooltip primitive** — third Ark UI component, progressive enhancement
6. **Shared pattern components** (Phase 2) — Button, FormField, Heading, Spinner, EmptyState — build as needed

---

## Existing Hooks to Preserve or Replace

- `hooks/use-dismiss.ts` — click-outside + Escape dismissal. Ark UI's Dialog/Popover/Menu handle this natively. Keep the hook for non-Ark custom components until they're migrated.
- `hooks/use-menu-toggle.ts` — open/close state + dismiss integration. Replaced by Ark UI Menu's built-in state management.

---

## Gotchas

- Ark UI uses ESM. Verify `@ark-ui/react` works with the current Vite + TanStack Start build without config changes.
- Ark UI's `data-state="open"` / `data-state="closed"` attributes are the hook for CSS animations. Design CSS transitions on these, not on conditional renders.
- Toast needs a provider at the app root level. Add `<Toaster />` in the layout alongside `ChatProvider`.
- Lucide icons are 24x24 by default. For inline-text icons (nav labels), use `size={16}` or `size={18}`.
- Token file `@import` order matters for CSS cascade. Import tokens before `global.css` resets.

## Further Reading

For agents exploring deeper on any decision:
- **Full audit with severity ratings:** `.memory/research/ui-ux-system-plan.md § Current State`
- **Library comparison tables:** `.memory/research/ui-ux-system-plan.md § Recommended Architecture`
- **Token category details (what each file should contain):** `.memory/research/ui-ux-system-plan.md § Phased Roadmap → Phase 0`
- **Responsive strategy (container queries, clamp, mobile-first):** `.memory/research/ui-ux-system-plan.md § Phased Roadmap → Phase 3`
- **Accessibility approach and testing tools:** `.memory/research/ui-ux-system-plan.md § Phased Roadmap → Phase 5`
- **Theme system for when designer joins:** `.memory/research/ui-ux-system-plan.md § Phased Roadmap → Phase 6`
- **Existing UX research (content management patterns):** `.memory/research/content-management-ux-patterns.md`
- **UX decision framework (agent vs user roles):** `docs/ux-decisions.md`
- **Accessibility scan rules (current WCAG coverage):** `.claude/skills/scan-accessibility/SKILL.md`
- **Ark UI styling guide:** `ark-ui.com/docs/guides/styling`
- **WAI-ARIA APG patterns:** `w3.org/WAI/ARIA/apg/patterns/`
