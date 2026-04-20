---
id: feature-design-system-foundation-shared-component-conventions
kind: feature
stage: review
tags: [design-system]
release_binding: null
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: design-system-foundation
---

# Design System Foundation — Shared Component Conventions (Phase 2)

## Sub-units

- [ ] Button component
- [ ] Spinner component
- [ ] FormField wrapper
- [ ] Heading component
- [ ] EmptyState component

## Overview

Establishes the shared API vocabulary for the Phase 2 pattern components (Button, FormField, Heading, Spinner, EmptyState) so they compose consistently and new components later inherit the same conventions. Not a full per-component design — those emerge from real call sites. This doc pins down the decisions that would otherwise drift across the 5 components if each is built in isolation.

The conventions document is done (marked `[x]` in the Design lane). The 5 components above are review-pending.

**Supersedes:** `styles/button.module.css` (`.primaryButton`, `.primaryButtonLink`) and ad-hoc `.primaryButton`/`.secondaryButton` CSS duplicated across `components/error/error-page.module.css` and other per-route modules.

## Follow-up

After Button + FormField land, promote this doc's conventions to a `snc-components` reference skill (tracked on release-0.2.6 under Skills & Tools). Skill auto-triggers on `components/ui/` edits.

---

## Conventions

### Variant Vocabulary

Five variants, same names across every component that has variants (Button today; Badge, Alert, Tag, etc. later):

| Variant | Role | Button example |
|---------|------|----------------|
| `primary` | Main CTA on a surface | Filled accent, high contrast |
| `secondary` | Alternate action alongside primary | Filled bg-elevated |
| `outline` | Low-weight action, grouped toolbars | Transparent bg + border |
| `ghost` | Icon-only / menu triggers / least-weight | Transparent, hover bg only |
| `danger` | Destructive | Filled error color |

**Rule:** A component never invents a new variant name. If a 6th role is needed, add it here first.

**Default variant:** `primary` for Button. Components pick their own default but pick from this list.

### Size Scale

Three sizes: `sm` | `md` | `lg`. Default is `md`.

| Token | Button height | Icon size | Use |
|-------|---------------|-----------|-----|
| `sm` | `calc(var(--space-md) * 2)` (~32px) | 16px | Toolbars, dense tables, inline actions |
| `md` | `calc(var(--space-lg) * 2)` (~40px) | 18px | Default — forms, page actions |
| `lg` | `calc(var(--space-xl) * 2)` (~48px) | 20px | Hero CTAs, landing |

Padding scales with size using the existing `--space-*` tokens. Font size follows: `sm` → `--font-size-sm`, `md` → `--font-size-base`, `lg` → `--font-size-lg`.

**Rule:** Size props use these three names. No `xs`/`xl` unless added here first.

### Loading State

Components that can be "busy" (Button today, later Form submit, data-fetching actions) expose `loading?: boolean`, not `isLoading`/`busy`/`pending`.

Loading behavior contract:
- `loading` implies `disabled` — do not require callers to set both
- Visible spinner replaces or overlays the content, never removes it (prevents layout shift)
- `aria-busy="true"` on the loading element
- Label text remains in the DOM (for screen readers); spinner is `aria-hidden`
- Click handlers are no-ops while loading (enforced inside the component, not caller)

Spinner used is the shared `Spinner` component — not per-component SVGs.

### Disabled Semantics

- `disabled` uses the native HTML attribute on interactive elements
- Visual: `opacity: 0.6; cursor: not-allowed;` (existing convention, carried forward)
- Disabled buttons do **not** receive hover styles — enforce via `:hover:not(:disabled)` (existing `button.module.css` pattern)
- Disabled form controls still get labels, error messages, and hints — don't hide related content

### Polymorphic `as` / Link Handling

Button needs to render as both `<button>` and `<a>` (the `primaryButtonLink` duplication today proves this). Convention:

- Component accepts `asChild?: boolean` following Ark UI's pattern — when true, merges props onto its single child instead of rendering its own element
- Callers wrap TanStack Router `<Link>` as the child: `<Button asChild><Link to="/x">Go</Link></Button>`
- Avoids a second component export (`ButtonLink`) and the CSS duplication in `styles/button.module.css`

**Rule:** Any component that could reasonably render as a link uses `asChild`, not a sibling `*Link` export.

### Icon Composition

Components don't take `icon` props. Callers compose Lucide icons as children:

```tsx
<Button><Plus size={18} aria-hidden /> Create</Button>
<Button variant="ghost" size="sm" aria-label="Close"><X size={16} aria-hidden /></Button>
```

Component CSS handles the gap between icon and text via `gap: var(--space-2xs)` on an inline-flex root. Icon size is the caller's responsibility but should match the size scale above.

### File Layout

Each shared pattern component follows the same two-file pattern established by the Ark UI wrappers:

```
components/ui/
  button.tsx             — component + variant/size types
  button.module.css      — all variant + size styles
```

Re-export from `components/ui/index.ts` for single-import surface.

---

## FormField a11y Contract

FormField is the one component with real correctness stakes. Its contract:

### Shape

```tsx
<FormField
  label="Email"
  htmlFor="email"
  hint="We never share this."
  error={errors.email}
  required
>
  <input id="email" type="email" />
</FormField>
```

### Wiring rules

- **`htmlFor` is required** — caller provides the id; FormField puts it on the `<label>`. The child input must use the same id.
- **`aria-describedby`** on the child input points to hint id + error id when present. FormField clones the child to inject this (or exposes `fieldId`/`describedBy` via a render-prop/context if cloneElement becomes painful — decide when building).
- **`aria-invalid="true"`** on the child input when `error` is truthy.
- **`aria-required="true"`** mirrors the `required` prop on the child input (don't assume native `required` — some inputs are custom).
- **Error messages** render in a `<p role="alert">` so screen readers announce on change.
- **Hint** is a plain `<p>` with a stable id derived from `htmlFor` (e.g., `${htmlFor}-hint`).
- **Required marker** — visual asterisk gets `aria-hidden`; the aria-required attribute carries the semantics.

### Error vs hint precedence

- Both can render simultaneously (hint above, error below)
- `aria-describedby` lists both ids, error first (announced first)

### What FormField does NOT do

- Does not manage input value/state — caller owns it
- Does not validate — caller passes pre-computed `error`
- Does not render the input element — child composition only

This contract applies to every form control (text, textarea, select, checkbox group, etc.). If a control can't be wrapped by FormField cleanly, FormField's API is wrong — don't bypass it.

---

## Component Specs

### Button component

5 variants (primary/secondary/outline/ghost/danger), 3 sizes (sm/md/lg), loading state with spinner overlay, `asChild` polymorphism via cloneElement. Data-attribute styling. `components/ui/button.tsx` + `.module.css`.

### Spinner component

Rotating SVG, `role="status"` + visually-hidden label, currentColor stroke, respects prefers-reduced-motion via `--duration-slow` token. `components/ui/spinner.tsx` + `.module.css`.

### FormField wrapper

Prop-based convenience wrapper on top of existing Ark UI Field parts (delegates aria wiring to Ark UI context). Added to existing `components/ui/field.tsx`.

### Heading component

Typed h1-h6 with independent size prop, fluid tokens for 2xl/3xl. `components/ui/heading.tsx` + `.module.css`. Migration of duplicated `.heading` CSS is a follow-up.

### EmptyState component

Icon + title + message + action, matches existing `.empty` visual pattern, `role="status"`. `components/ui/empty-state.tsx` + `.module.css`. Migration of ad-hoc empty states is a follow-up.

---

## Out of Scope

- Per-component visual design (colors, exact spacing) — driven by tokens, finalized when building each
- Animation/motion specifics beyond existing `--duration-*` tokens
- Keyboard shortcut bindings
- Theme system (Phase 6)
- `cva` / class-variance-authority or similar — CSS Modules + `data-variant` attribute selectors are sufficient

## Implementation Order

1. **Button** — most-used, validates variant + size + `asChild` + loading conventions
2. **FormField** — a11y contract lives or dies on real form integration (start with auth/creator forms)
3. **Spinner** — needed by Button's loading state, build as part of Button work if not already
4. **Heading** — mechanical, collapses 4x `.heading` duplication
5. **EmptyState** — composes Heading + icon + optional action Button

Steps 1-3 likely one session. 4-5 opportunistic.
