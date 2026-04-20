---
tags: [testing, design-system]
release_binding: null
created: 2026-04-20
---

# UI primitives unit test coverage

No dedicated unit tests for the 5 Phase 2 shared primitives (`Button`, `Spinner`, `FormField`, `Heading`, `EmptyState`) in [apps/web/src/components/ui/](../../apps/web/src/components/ui). They're exercised indirectly through consumers (event-form, creator-header, studio-inquiry-form, error-page, etc.).

Primary gap is **Button** — its `loading` contract, `disabled` semantics, and `asChild` polymorphism have contract-shaped behavior that consumer tests don't cleanly isolate. FormField's a11y wiring (`aria-describedby` chaining, `aria-invalid`, `aria-required`) is also worth direct coverage.

Heading and EmptyState are mostly pass-through of children; thin coverage is defensible. Spinner is visual-only.

Surfaced during `/review` of `design-system-foundation-shared-component-conventions` (2026-04-20). Feature signed off as-is; this covers a testing gap, not a code gap.

## Scope when picked up

- `apps/web/tests/unit/components/ui/button.test.tsx` — variant/size render, `loading` state (disabled + spinner + layout preservation), `disabled` (no hover, click noop), `asChild` prop merge onto child `<Link>`
- `apps/web/tests/unit/components/ui/field.test.tsx` — `htmlFor` → label + input association, `aria-describedby` includes hint+error ids in right order, `aria-invalid` on error, `aria-required` mirrors prop, error `role="alert"`

Spinner/Heading/EmptyState optional — add if convenient, don't block on them.

## Route to resolution

Most likely inline-implemented during the next `/release-deploy 0.3.0` testing gate (`/e2e-triage`) or picked up independently as a small story.
