# Rule: Form Labels

> Every `<input>`, `<select>`, and `<textarea>` must have a programmatically associated label.

## Motivation

WCAG 1.3.1 (Info and Relationships) and 3.3.2 (Labels or Instructions, Level A). Screen
readers use the label to announce what a field is for. Without it, users hear "edit text"
with no context. Three valid approaches: `<label htmlFor>`, `aria-label`, or `aria-labelledby`.

## Before / After

### From this codebase: booking form labels

**Before:** (positive example from `apps/web/src/components/booking/booking-form.tsx` lines 167-169)
```tsx
<label htmlFor="booking-notes">Notes</label>
<textarea id="booking-notes" ... />
```
Correct — `htmlFor` matches `id`, creating a programmatic association.

**Before:** (positive example from `apps/web/src/components/booking/booking-form.tsx` lines 138, 145)
```tsx
<input
  type="date"
  aria-label={`Preferred date ${index + 1}`}
  ...
/>
```
Correct — dynamic `aria-label` for inputs generated in a loop where a visible label is impractical.

**Before:** (positive example from `apps/web/src/components/federation/follow-fediverse-dialog.tsx` lines 75-76)
```tsx
<label htmlFor="fediverse-instance">Instance</label>
<input id="fediverse-instance" ... />
```

### Synthetic example: unlabeled input

**Before:**
```tsx
<input type="email" placeholder="Enter email" />
```
The `placeholder` disappears when the user types — it's not a label.

**After:**
```tsx
<label htmlFor="email-input">Email address</label>
<input id="email-input" type="email" placeholder="Enter email" />
```

## Exceptions

- Hidden inputs (`type="hidden"`) — not user-facing
- Submit buttons — button text serves as the label
- Inputs with `aria-labelledby` pointing to visible text elsewhere in the DOM
- Search inputs with a visible search icon button (use `aria-label="Search"`)

## Scope

- Applies to: all TSX files in `apps/web/src/components/` and `apps/web/src/routes/`
- Does NOT apply to: test files, API routes
