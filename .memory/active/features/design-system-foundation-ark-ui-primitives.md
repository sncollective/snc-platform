---
id: feature-design-system-foundation-ark-ui-primitives
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

# Design System Foundation — Ark UI Primitives (Phase 1)

## Sub-units

- [x] Dialog
- [x] Toast
- [x] Tooltip
- [x] Menu
- [x] Tabs
- [x] Select
- [x] Popover
- [x] Field
- [x] Checkbox
- [x] Switch
- [x] Progress
- [x] Collapsible

## Overview

Create 12 styled wrapper components in `components/ui/` using Ark UI for accessible behavior and CSS Modules + design tokens for visual styling. Each primitive gets two files: `{name}.tsx` (wrapper) + `{name}.module.css` (styles). Plus Toast provider wiring in the root layout.

**Package to install:** `@ark-ui/react` in `apps/web`

**Pattern:** Every wrapper re-exports Ark UI sub-components with `className` props attached. Consumers import from `components/ui/{name}.js`, never from `@ark-ui/react` directly. Portal placement is handled inside the wrapper — consumers don't think about it. Animations use `[data-state="open"]`/`[data-state="closed"]` selectors with `--duration-*` and `--ease-*` tokens (automatic reduced-motion via token reset).

**Existing component conventions** (from `components/ui/optional-image.tsx`):
- Named exports only, no defaults
- Props interface named `{Component}Props` with `readonly` modifiers
- JSDoc one-liner on exported components
- Import paths use `.js` extension
- CSS Modules imported as `styles`

---

## Implementation Units

### Unit 0: Install `@ark-ui/react`

```bash
bun add --filter @snc/web @ark-ui/react
```

**Acceptance Criteria:**
- [x] `@ark-ui/react` in `apps/web/package.json` dependencies
- [x] `bun run --filter @snc/web build` succeeds

---

### Unit 1: Dialog

**Files:** `platform/apps/web/src/components/ui/dialog.tsx` + `dialog.module.css`

```tsx
// dialog.tsx
import type { ComponentProps, ReactNode } from "react";
import { Dialog as ArkDialog } from "@ark-ui/react/dialog";
import { Portal } from "@ark-ui/react/portal";
import styles from "./dialog.module.css";

// ── Public Types ──

export interface DialogProps extends ComponentProps<typeof ArkDialog.Root> {}

export interface DialogContentProps {
  readonly children: ReactNode;
  readonly className?: string;
}

// ── Public API ──

/** Accessible modal dialog with focus trap, scroll lock, and backdrop dismiss. */
export function DialogRoot(props: DialogProps) {
  return <ArkDialog.Root {...props} />;
}

/** Semi-transparent overlay behind the dialog. */
export function DialogBackdrop() {
  return (
    <Portal>
      <ArkDialog.Backdrop className={styles.backdrop} />
    </Portal>
  );
}

/** Positioned dialog content panel. Renders in a Portal. */
export function DialogContent({ children, className }: DialogContentProps) {
  return (
    <Portal>
      <ArkDialog.Positioner className={styles.positioner}>
        <ArkDialog.Content className={className ? `${styles.content} ${className}` : styles.content}>
          {children}
        </ArkDialog.Content>
      </ArkDialog.Positioner>
    </Portal>
  );
}

/** Dialog heading. Renders as h2. */
export function DialogTitle(props: ComponentProps<typeof ArkDialog.Title>) {
  return <ArkDialog.Title className={styles.title} {...props} />;
}

/** Dialog description text. */
export function DialogDescription(props: ComponentProps<typeof ArkDialog.Description>) {
  return <ArkDialog.Description className={styles.description} {...props} />;
}

/** Button that closes the dialog. */
export function DialogCloseTrigger(props: ComponentProps<typeof ArkDialog.CloseTrigger>) {
  return <ArkDialog.CloseTrigger className={styles.close} {...props} />;
}

/** Button that opens the dialog. Passes through without styling. */
export const DialogTrigger = ArkDialog.Trigger;
```

**Acceptance Criteria:**
- [x] Exports: `DialogRoot`, `DialogBackdrop`, `DialogContent`, `DialogTitle`, `DialogDescription`, `DialogCloseTrigger`, `DialogTrigger`
- [x] Focus trapped inside open dialog
- [x] Escape key closes dialog
- [x] Backdrop click closes dialog
- [x] Scroll locked when open
- [x] `[data-state]` animations work
- [x] Builds without errors

---

### Unit 2: Toast

**Files:** `platform/apps/web/src/components/ui/toast.tsx` + `toast.module.css`

```tsx
// toast.tsx
import { Toast as ArkToast, Toaster, createToaster } from "@ark-ui/react/toast";
import styles from "./toast.module.css";

// ── Module-level singleton ──

/** Toast engine. Import and call `toaster.success(...)` from anywhere. */
export const toaster = createToaster({
  placement: "bottom-end",
  duration: 5000,
  removeDelay: 200,
  max: 5,
  offsets: "1rem",
});

// ── Public API ──

/** Mount once in the root layout. Renders all active toasts. */
export function ToastProvider() {
  return (
    <Toaster toaster={toaster}>
      {(toast) => (
        <ArkToast.Root className={styles.root}>
          <ArkToast.Title className={styles.title}>{toast.title}</ArkToast.Title>
          <ArkToast.Description className={styles.description}>
            {toast.description}
          </ArkToast.Description>
          <ArkToast.CloseTrigger className={styles.close}>
            &times;
          </ArkToast.CloseTrigger>
        </ArkToast.Root>
      )}
    </Toaster>
  );
}
```

**Acceptance Criteria:**
- [x] Exports: `toaster` (singleton), `ToastProvider` (component)
- [x] `toaster.success()`, `.error()`, `.warning()`, `.info()` create styled toasts
- [x] Toasts auto-dismiss after 5 seconds
- [x] Toasts stack from bottom-right
- [x] Close button dismisses toast
- [x] Slide-in/out animations work
- [x] Builds without errors

---

### Unit 3: Toast Provider Wiring

**File:** `platform/apps/web/src/routes/__root.tsx` (modify)

Add `ToastProvider` to `RootLayout` after the existing providers, before the closing `</div>`:

```tsx
// Add import at top (after existing component imports):
import { ToastProvider } from "../components/ui/toast.js";
```

**Acceptance Criteria:**
- [x] `ToastProvider` renders in the root layout
- [x] `__root.test.tsx` still passes

---

### Unit 4: Tooltip

**Files:** `platform/apps/web/src/components/ui/tooltip.tsx` + `tooltip.module.css`

Simplified API — single `<Tooltip>` component wraps the trigger and handles positioning/portal internally.

**Acceptance Criteria:**
- [x] Exports: `Tooltip`
- [x] Shows on hover after delay
- [x] Shows on focus (keyboard accessible)
- [x] Escape closes
- [x] Positioned correctly (auto-flips near edges)
- [x] Builds without errors

---

### Unit 5: Menu

**Files:** `platform/apps/web/src/components/ui/menu.tsx` + `menu.module.css`

**Acceptance Criteria:**
- [x] Exports: `MenuRoot`, `MenuTrigger`, `MenuContent`, `MenuItem`, `MenuSeparator`, `MenuItemGroup`, `MenuItemGroupLabel`
- [x] Arrow key navigation between items
- [x] Escape closes menu
- [x] Click outside closes menu
- [x] Typeahead navigation
- [x] Builds without errors

---

### Unit 6: Tabs

**Files:** `platform/apps/web/src/components/ui/tabs.tsx` + `tabs.module.css`

`TabsIndicator` uses Ark UI's built-in CSS variables (`--left`, `--width`) for smooth position transitions.

**Acceptance Criteria:**
- [x] Exports: `TabsRoot`, `TabsList`, `TabsTrigger`, `TabsContent`, `TabsIndicator`
- [x] Arrow key navigation between tabs
- [x] Indicator animates between active tabs
- [x] Lazy mount supported via `lazyMount` prop
- [x] Builds without errors

---

### Unit 7: Select

**Files:** `platform/apps/web/src/components/ui/select.tsx` + `select.module.css`

`createListCollection` is re-exported so consumers don't import from `@ark-ui/react` directly.

**Acceptance Criteria:**
- [x] Exports: `SelectRoot`, `SelectLabel`, `SelectControl`, `SelectTrigger`, `SelectValueText`, `SelectContent`, `SelectItem`, `SelectItemText`, `SelectItemIndicator`, `SelectItemGroup`, `SelectItemGroupLabel`, `SelectHiddenSelect`, `createListCollection`
- [x] Arrow key navigation
- [x] Typeahead search
- [x] Escape closes
- [x] `data-highlighted` and `data-state="checked"` styling
- [x] Builds without errors

---

### Unit 8: Popover

**Files:** `platform/apps/web/src/components/ui/popover.tsx` + `popover.module.css`

Non-modal by default. `PopoverAnchor` is re-exported for cases where the visual anchor differs from the trigger.

**Acceptance Criteria:**
- [x] Exports: `PopoverRoot`, `PopoverTrigger`, `PopoverContent`, `PopoverTitle`, `PopoverDescription`, `PopoverCloseTrigger`, `PopoverAnchor`
- [x] Escape closes
- [x] Click outside closes
- [x] Auto-positions (flips near viewport edges)
- [x] Builds without errors

---

### Unit 9: Field

**Files:** `platform/apps/web/src/components/ui/field.tsx` + `field.module.css`

Ark UI Field auto-wires `aria-describedby` between input and helper/error text, and `aria-invalid` from the `invalid` prop. This was a major accessibility gap noted in the audit (57% ARIA coverage).

**Acceptance Criteria:**
- [x] Exports: `FieldRoot`, `FieldLabel`, `FieldInput`, `FieldTextarea`, `FieldSelect`, `FieldHelperText`, `FieldErrorText`, `FieldRequiredIndicator`
- [x] `aria-describedby` auto-wired between input and helper/error
- [x] `aria-invalid` set when `invalid` prop is true
- [x] `data-invalid` styling applies to label, input, and error text
- [x] Disabled state propagates to all children
- [x] Builds without errors

---

### Unit 10: Checkbox

**Files:** `platform/apps/web/src/components/ui/checkbox.tsx` + `checkbox.module.css`

Simplified API — single `<Checkbox>` component. Children become the label. Inline SVG checkmark avoids a Lucide React dependency.

**Acceptance Criteria:**
- [x] Exports: `Checkbox`
- [x] Space key toggles
- [x] Visual checked/unchecked/indeterminate states
- [x] Form-submittable via hidden input
- [x] Builds without errors

---

### Unit 11: Switch

**Files:** `platform/apps/web/src/components/ui/switch.tsx` + `switch.module.css`

Simplified API — single `<Switch>` component. Children become the label.

**Acceptance Criteria:**
- [x] Exports: `Switch`
- [x] Space and Enter toggle
- [x] Visual slide animation on toggle
- [x] Form-submittable via hidden input
- [x] Builds without errors

---

### Unit 12: Progress

**Files:** `platform/apps/web/src/components/ui/progress.tsx` + `progress.module.css`

Ark UI Progress uses `--percent` CSS variable internally, which drives the range width. For indeterminate state, set `value={null}` on `ProgressRoot`.

**Acceptance Criteria:**
- [x] Exports: `ProgressRoot`, `ProgressLabel`, `ProgressValueText`, `ProgressTrack`, `ProgressRange`
- [x] Determinate: range fills proportionally to value
- [x] Indeterminate: sliding animation when value is null
- [x] `aria-valuenow`, `aria-valuemin`, `aria-valuemax` set correctly
- [x] Builds without errors

---

### Unit 13: Collapsible

**Files:** `platform/apps/web/src/components/ui/collapsible.tsx` + `collapsible.module.css`

Ark UI Collapsible exposes `--height` CSS variable on the content element, enabling smooth height animation without JavaScript measurement. `CollapsibleIndicator` rotates 90 degrees when open — works well with a chevron-right icon from Lucide.

**Acceptance Criteria:**
- [x] Exports: `CollapsibleRoot`, `CollapsibleTrigger`, `CollapsibleContent`, `CollapsibleIndicator`
- [x] Space/Enter toggles content
- [x] `aria-expanded` set on trigger
- [x] Height animation on expand/collapse
- [x] Indicator rotates on state change
- [x] Builds without errors

---

## Implementation Order

1. **Unit 0:** Install `@ark-ui/react`
2. **Units 1-2, 4-13:** All component wrappers — can be created in parallel (no interdependencies between components)
3. **Unit 3:** Toast provider wiring in `__root.tsx` — depends on Unit 2 (Toast)

## Testing

### Build Verification

The primary test for UI wrapper components is that they build and export correctly. These are thin wrappers around Ark UI — the behavioral testing (focus trap, keyboard nav, ARIA) is Ark UI's responsibility, covered by their test suite.

```bash
# Build succeeds with all new components
bun run --filter @snc/web build

# Existing tests still pass
bun run --filter @snc/web test
```

### Component Export Test

**File:** `platform/apps/web/tests/unit/components/ui/primitives.test.ts`

```typescript
import { describe, it, expect } from "vitest";

describe("ui primitive exports", () => {
  it("dialog exports all expected members", async () => {
    const mod = await import("../../../../src/components/ui/dialog.js");
    expect(mod.DialogRoot).toBeDefined();
    expect(mod.DialogBackdrop).toBeDefined();
    expect(mod.DialogContent).toBeDefined();
    expect(mod.DialogTitle).toBeDefined();
    expect(mod.DialogDescription).toBeDefined();
    expect(mod.DialogCloseTrigger).toBeDefined();
    expect(mod.DialogTrigger).toBeDefined();
  });

  it("toast exports toaster singleton and provider", async () => {
    const mod = await import("../../../../src/components/ui/toast.js");
    expect(mod.toaster).toBeDefined();
    expect(mod.ToastProvider).toBeDefined();
    expect(typeof mod.toaster.success).toBe("function");
    expect(typeof mod.toaster.error).toBe("function");
  });

  // ... (remaining assertions per component in original design)
});
```

## Verification Checklist

```bash
# 1. Install dependency
bun add --filter @snc/web @ark-ui/react

# 2. Build succeeds with all new components
bun run --filter @snc/web build

# 3. All tests pass (existing + new export test)
bun run --filter @snc/web test

# 4. Dev server renders correctly
pm2 restart web
# Manual: load any page — verify no regressions, ToastProvider renders without errors
```
