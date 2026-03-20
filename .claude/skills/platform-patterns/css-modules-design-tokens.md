# Pattern: CSS Modules + Design Tokens

Global CSS custom properties define all design tokens in `global.css`; component CSS Modules consume them via `var(--token-name)`. Components import the module as `styles` and apply classes via `className={styles.className}`.

## Rationale

CSS custom properties in `:root` create a single source of truth for colors, spacing, typography, and radius values. CSS Modules scope class names per component, preventing collisions. Using `var(--token)` in CSS Modules keeps components consistent with the design system without tight coupling — changing a token in `global.css` updates every component automatically.

## Examples

### Example 1: Design token definitions in global.css
**File**: `apps/web/src/styles/global.css:3`
```css
:root {
  /* Colors */
  --color-bg: #1a1a2e;
  --color-bg-elevated: #252542;
  --color-bg-input: #2a2a4a;
  --color-text: #f0f0f0;
  --color-text-muted: #a0a0b0;
  --color-accent: #f5a623;
  --color-accent-hover: #e09510;
  --color-secondary: #5bb5b5;
  --color-error: #ef5350;
  --color-border: #3a3a5c;

  /* Typography */
  --font-ui: "Inter", system-ui, -apple-system, sans-serif;
  --font-heading: Georgia, "Times New Roman", serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;

  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;

  /* Borders */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Derived tokens */
  --color-error-bg: rgba(239, 83, 80, 0.1);
  --shadow-dropdown: 0 4px 16px rgba(0, 0, 0, 0.3);
}
```

### Example 2: Auth form CSS module consuming tokens
**File**: `apps/web/src/components/auth/auth-form.module.css:1`
```css
.form {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.input {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-ui);
  font-size: var(--font-size-base);
  transition: border-color 0.15s;
}

.inputError {
  border-color: var(--color-error);
}

.fieldError {
  font-size: var(--font-size-sm);
  color: var(--color-error);
}

.serverError {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-error-bg);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-sm);
  color: var(--color-error);
  font-size: var(--font-size-sm);
}
```

### Example 3: CSS module import and conditional class composition in JSX
**File**: `apps/web/src/components/auth/login-form.tsx:94`
```typescript
import styles from "./auth-form.module.css";

// Single class:
<input className={styles.input} />

// Conditional class composition:
<input
  className={
    fieldErrors.email
      ? `${styles.input} ${styles.inputError}`
      : styles.input
  }
/>

// Error message with role="alert":
{fieldErrors.email && (
  <span className={styles.fieldError} role="alert">
    {fieldErrors.email}
  </span>
)}
```

### Example 4: Nav bar module with responsive media query
**File**: `apps/web/src/components/layout/nav-bar.module.css`
```css
.header {
  position: sticky;
  top: 0;
  height: var(--nav-height);
  background: var(--color-bg-elevated);
  border-bottom: 1px solid var(--color-border);
  z-index: 100;
}

/* Responsive: hide desktop links on mobile */
@media (max-width: 767px) {
  .links {
    display: none;
  }
}
```

## When to Use

- Every component in `apps/web` that needs styling
- Reference design tokens via `var(--token-name)` — never hardcode hex values or pixel sizes
- Conditional class application: template literal `${styles.base} ${styles.modifier}` (no classnames library needed)

## When NOT to Use

- Inline styles (`style={{ color: '...' }}`) — use CSS Modules instead
- Global class names not scoped to a component — unless they're intentional global utilities in `global.css`

## Common Violations

- Hardcoding color values (e.g., `color: #f5a623`) instead of `var(--color-accent)`
- Using `rgba()` for shadow/error background inline instead of the derived token (`--shadow-dropdown`, `--color-error-bg`)
- Importing CSS from a different component's module (cross-component style leakage)
- Adding component-level tokens without adding them to `global.css` first
