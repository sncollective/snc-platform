# Rule: Keyboard Interaction

> Custom interactive widgets must handle keyboard events per WAI-ARIA Authoring Practices patterns.

## Motivation

WCAG 2.1.1 (Keyboard, Level A). All functionality must be operable via keyboard. Native
elements (`<button>`, `<a>`, `<select>`) handle this automatically, but custom widgets
(dropdowns, dialogs, popovers, custom selects) need explicit keyboard handlers following
WAI-ARIA APG patterns: Tab moves focus in/out, Arrow keys navigate within, Enter/Space
activates, Escape closes.

## Before / After

### From this codebase: keyboard support on custom elements

**Before:** (positive example from `apps/web/src/components/creator/team-section.tsx` lines 269-273)
```tsx
onKeyDown={(e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    handleAddMember(candidate.id);
  }
}}
```
Correct — handles both Enter and Space keys (standard activation pattern).

**Before:** (positive example from `apps/web/src/components/federation/follow-fediverse-dialog.tsx` lines 86-88)
```tsx
onKeyDown={(e) => {
  if (e.key === "Enter") handleFollow();
}}
```
Enter key triggers the action — correct for a text input.

**Before:** (positive example from `apps/web/src/hooks/use-menu-toggle.ts`)
Menu toggle hook handles Escape key for closing menus.

**Before:** (positive example from `apps/web/src/components/layout/user-menu.tsx`)
Menu button uses `aria-expanded`, `aria-haspopup` — correct ARIA state management.

### Synthetic example: custom dropdown without keyboard support

**Before:**
```tsx
<div className={styles.dropdown} onClick={() => setOpen(!open)}>
  <span>{selected}</span>
  {open && (
    <ul>
      {options.map((opt) => (
        <li key={opt.id} onClick={() => select(opt)}>{opt.label}</li>
      ))}
    </ul>
  )}
</div>
```

**After:**
```tsx
<button
  aria-haspopup="listbox"
  aria-expanded={open}
  onClick={() => setOpen(!open)}
  onKeyDown={(e) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "ArrowDown" && !open) setOpen(true);
  }}
>
  {selected}
</button>
{open && (
  <ul role="listbox" onKeyDown={handleListKeyDown}>
    {options.map((opt) => (
      <li key={opt.id} role="option" tabIndex={-1} onClick={() => select(opt)}>
        {opt.label}
      </li>
    ))}
  </ul>
)}
```

## Exceptions

- Native `<button>`, `<a>`, `<select>` elements — keyboard support is built-in
- Components that are keyboard-accessible via their native child elements
- Non-interactive decorative components (no click handlers, no focus needed)

## Scope

- Applies to: custom interactive components in `apps/web/src/components/` — focus on dropdowns, modals, popovers, custom selects, tab panels
- Does NOT apply to: test files, components using only native interactive elements
