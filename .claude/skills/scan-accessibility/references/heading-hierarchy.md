# Rule: Heading Hierarchy

> Heading levels must not skip (no h1 → h3 without h2); each route/page should have exactly one h1.

## Motivation

WCAG 1.3.1 (Info and Relationships, Level A). Screen reader users navigate by heading
level — they jump between h2s to scan page sections, then drill into h3s for details.
Skipped levels break this navigation model. Multiple h1s per page confuse the document
outline.

## Before / After

### From this codebase: route pages

**Before:** (positive example — route files)
Each route file (`routes/feed.tsx`, `routes/dashboard.tsx`, `routes/pricing.tsx`, etc.)
has a single `<h1>` for the page title.

**Before:** (positive example from `apps/web/src/components/federation/follow-fediverse-dialog.tsx` line 66)
```tsx
<h2>Follow via Fediverse</h2>
```
Correct — `<h2>` inside a dialog is appropriate since the dialog is a subsection of the page.

**Before:** (needs verification — `apps/web/src/components/booking/booking-form.tsx` line 114)
```tsx
<h4 className={formStyles.formHeading}>Book a Session</h4>
```
If this component is rendered on a page where h1 → h2 → h3 are already present, h4 is
correct. If it's rendered where the last heading is h2, this skips h3.

### Synthetic example: skipped heading level

**Before:**
```tsx
<h1>Creator Profile</h1>
<section>
  <h3>Latest Content</h3>  {/* Skips h2! */}
  <div>...</div>
</section>
```

**After:**
```tsx
<h1>Creator Profile</h1>
<section>
  <h2>Latest Content</h2>
  <div>...</div>
</section>
```

## Exceptions

- Content inside `<dialog>` elements — heading hierarchy can restart within the dialog context
- Markdown-rendered user content — the user controls heading levels; the platform can't enforce hierarchy
- Third-party embedded content (iframes, widgets)
- Headings used in visually hidden skip-navigation links

## Scope

- Applies to: route files in `apps/web/src/routes/` (page-level hierarchy) and component files
- Components must be aware of their expected nesting context — a component that renders `<h3>` should document that it expects to be nested under an `<h2>`
- Does NOT apply to: test files, API routes
