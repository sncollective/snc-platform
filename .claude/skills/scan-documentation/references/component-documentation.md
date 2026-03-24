# Rule: Component Missing Purpose Doc

> Exported React components with 3+ props should have a `/** */` comment explaining their purpose.

## Motivation

Complex React components (those with multiple props) serve specific roles in the UI. A brief doc
comment on the component explains what it renders and when to use it — information that's hard to
extract from the prop types alone.

Simple presentational components with 1-2 props (e.g., a `Badge` with `label` and `variant`) are
self-documenting. The 3+ prop threshold targets components with enough complexity that a reader
benefits from knowing the component's purpose before reading the implementation.

## Before / After

### Synthetic example: complex component without doc

**Before:**
```typescript
export function BookingForm({
  service,
  onSubmit,
  isSubmitting,
  error,
}: BookingFormProps) {
  // ... 80 lines of form logic
}
```

**After:**
```typescript
/**
 * Booking request form for a specific service.
 * Renders date picker, message field, and submit button.
 * Validates against service availability before submission.
 */
export function BookingForm({
  service,
  onSubmit,
  isSubmitting,
  error,
}: BookingFormProps) {
  // ... 80 lines of form logic
}
```

The doc explains what the component renders and its key behavior (validation) — information
not obvious from `BookingFormProps`.

### Components that don't need docs

```typescript
// Simple presentational — name + props tell the full story
export function KpiCard({ label, value, trend }: KpiCardProps) { ... }

// Thin wrapper — delegates to a library component
export function VariantSelector({ variants, selected, onChange }: VariantSelectorProps) { ... }
```

These are borderline at 3 props. Use judgment — if the component name and prop names fully
explain the purpose, skip the doc.

## Exceptions

- **Simple presentational components** — under 30 lines with clear prop names
- **Components under 3 props** — self-documenting from name and types
- **Layout components** — `NavBar`, `Footer`, `MobileMenu` are obvious from the name
- **Page-level route components** — these are the route file itself; the filename is the doc

## Scope

- **Scan:** `apps/web/src/components/` — all `.tsx` files
- **Also check:** `apps/web/src/contexts/` for context providers (these are Always-tier regardless of prop count)
- **Exclude:** test files, CSS modules, route files (`routes/`)
