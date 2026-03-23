# Rule: Semantic Interactive Elements

> Use native `<button>`, `<a>`, `<select>` instead of `<div>` or `<span>` with click handlers.

## Motivation

WCAG 4.1.2 (Name, Role, Value, Level A). Native interactive elements provide keyboard
support, focus management, and screen reader announcements for free. A `<div onClick>`
requires manual `role`, `tabIndex`, and `onKeyDown` to be accessible — and these are
easy to get wrong or forget.

## Before / After

### From this codebase: team member candidate list

**Before:** (actual code from `apps/web/src/components/creator/team-section.tsx` lines 265-278)
```tsx
<li
  role="option"
  aria-selected={false}
  tabIndex={0}
  onClick={() => handleAddMember(candidate.id)}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleAddMember(candidate.id);
    }
  }}
>
```
This works — keyboard support was added manually — but a `<button>` inside the `<li>`
would be simpler and more reliable.

**After:**
```tsx
<li>
  <button type="button" onClick={() => handleAddMember(candidate.id)}>
    {candidate.displayName}
  </button>
</li>
```
The `<button>` provides Enter/Space handling, focus, and role="button" automatically.

### Synthetic example: clickable card

**Before:**
```tsx
<div className={styles.card} onClick={() => navigate(`/item/${id}`)}>
  <h3>{title}</h3>
  <p>{description}</p>
</div>
```

**After:**
```tsx
<div className={styles.card}>
  <h3><a href={`/item/${id}`}>{title}</a></h3>
  <p>{description}</p>
</div>
```

## Exceptions

- Elements with click handlers purely for analytics tracking (use `role="presentation"`)
- Wrapper divs with `onClick` that delegate to a nested interactive element (the inner element is the accessible target)
- Third-party components that manage their own ARIA semantics

## Scope

- Applies to: all TSX files in `apps/web/src/components/` and `apps/web/src/routes/`
- Does NOT apply to: test files, server-side only code
