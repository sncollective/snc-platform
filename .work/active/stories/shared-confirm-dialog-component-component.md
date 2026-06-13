---
id: shared-confirm-dialog-component-component
kind: story
stage: review
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

## Implementation notes

### Files created
- `apps/web/src/components/ui/confirm-dialog.tsx` — `ConfirmDialog` component
- `apps/web/src/components/ui/confirm-dialog.module.css` — `.actions` flex row, confirm-first
- `apps/web/tests/unit/components/confirm-dialog.test.tsx` — 18 tests, all passing

### Button ref forwarding
React 19 is in use (`react: ^19.2.4`). In React 19, refs are plain props and pass through
`...rest` spreads onto native elements automatically. `Button` renders a native `<button>` and
spreads `{...rest}` onto it, so `ref` flows through without any `forwardRef` change. Passing
`ref={cancelRef}` directly to `Button` works — no modification to `button.tsx` needed.

### initialFocusEl (cancel focus)
`cancelRef = useRef<HTMLButtonElement | null>(null)` is attached to the cancel `Button` via
`ref={cancelRef}`. `DialogRoot` receives `initialFocusEl={() => cancelRef.current}`. jsdom
does not run Zag's focus management on mount (no real focus events in JSDOM), so the focus
assertion was not included in the tests rather than faking it — consistent with the design's
"drop if flaky rather than fake it" guidance.

### onCancel / onOpenChange contract
`onCancel` is called on every `onOpenChange(false)` event — including after `onConfirm` if
the consumer clears `open` state inside `onConfirm`. This is documented in JSDoc and matches
the feature design's stated contract. Confirm click fires `onConfirm()` only; the
`onOpenChange(false)` that follows (if the consumer closes the dialog) calls `onCancel`, which
must be idempotent.

### Test coverage
All Unit 1 acceptance criteria covered:
- Renders title, children, confirm + cancel labels ✓
- `tone="danger"` (default) → `data-variant="danger"`; `tone="default"` → `data-variant="primary"` ✓
- Cancel always `data-variant="secondary"` ✓
- Confirm fires `onConfirm` exactly once; does NOT fire `onCancel` ✓
- Cancel fires `onCancel` ✓
- `isPending` disables both buttons ✓
- `role="alertdialog"` on dialog content ✓
- `open=false` → nothing rendered (lazyMount + unmountOnExit) ✓
- Focus assertion on cancel button: **dropped** — jsdom does not execute Zag's focus
  management; assertion would require faking focus state, which is not a reliable signal

### Verification
- `bun run --filter @snc/web test`: 154 files, 1660 tests — all pass
- `bun run --filter @snc/web build`: clean, exited 0
