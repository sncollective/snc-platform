---
id: shared-confirm-dialog-component-component
kind: story
stage: implementing
tags: [design-system]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
parent: shared-confirm-dialog-component
---

# ConfirmDialog component + unit tests

## Scope
Unit 1 of the parent feature: build
`apps/web/src/components/ui/confirm-dialog.tsx` + `confirm-dialog.module.css` +
`apps/web/tests/unit/components/confirm-dialog.test.tsx`. The exact props interface,
composition notes (alertdialog role, cancel-first `initialFocusEl`, Button variants by
`tone`, consequence `children` slot, `isPending`), and acceptance criteria live in the
parent feature body — follow them exactly. If `ui/Button` doesn't forward refs, adding
`forwardRef` to it is in scope (behavior-neutral).

## Acceptance criteria
- All Unit 1 acceptance criteria in the parent feature body.
- `bun run --filter @snc/web test` and `build` green.
