---
id: a11y-creator-form-heading-hierarchy
kind: backlog
tags: [streaming, creators, accessibility]
created: 2026-06-12
---

# A11y: SimulcastDestinationManager form uses H2 inside an H2 section (WCAG 1.3.1)

## Violation

WCAG 2.2 SC 1.3.1 Info and Relationships — A

When the "Add Destination" or "Edit Destination" form opens in `SimulcastDestinationManager`, it renders `<h2>Add Destination</h2>` inside a `<form>`. This form lives within the "Simulcast Destinations" `<section>` which has its own `<h2>Simulcast Destinations</h2>`. The result is two H2s in a parent–child relationship — "Simulcast Destinations" → [form] → "Add Destination" — creating an incorrect heading hierarchy that implies the form heading is a sibling of the section heading.

## File and line

`apps/web/src/components/simulcast/simulcast-destination-manager.tsx:187`:
```tsx
<h2>{editingId !== null ? "Edit Destination" : "Add Destination"}</h2>
```

This H2 should be H3 (child of the H2 section) or removed in favor of the form's aria context.

## Fix

Change `<h2>` to `<h3>` in the form rendering, or remove it and use `aria-label` on the `<form>` element.

## Severity

2 (minor) — assistive technology heading navigation becomes confusing with duplicate H2 level.

## Evidence

`.memory/scratchpad/streaming-playout-ux-review/creator-desktop-c3-add-form.png`
