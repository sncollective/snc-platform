---
id: shared-confirm-dialog-component
kind: feature
stage: implementing
tags: [design-system]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-13
parent: null
---

# Design-system: shared confirm-dialog component

## Brief
UX-review cross-surface finding (2026-06-12): destructive actions either confirm via
bare `window.confirm` (simulcast destination delete in
`simulcast-destination-manager.tsx:147` — shared component, hits admin AND creator
surfaces; filed `bug-admin-simulcast-window-confirm`) or, before the creator fix
round, didn't confirm at all. Build one accessible confirm dialog (composing the
existing `apps/web/src/components/ui/dialog.tsx` Ark UI wrappers; design tokens;
consequence-message slot; destructive-action button styling; focus management) and
adopt it at the known sites.

Promoted from backlog to a standalone design-system feature at the
playout-admin-redesign epic design (user decision 2026-06-12). Known consumers and
convergence targets: the simulcast destination delete (replaces `window.confirm`;
closes `bug-admin-simulcast-window-confirm` when adopted there), the
`playout-admin-redesign-honest-actions` feature (channel create-warning + delete
confirmation — declares the `depends_on` edge), and the creator key-revoke dialog
that just landed (story `creator-key-revoke-confirmation` built a local
DialogRoot-based confirm in `streaming.tsx`, 2026-06-12) — that local instance is
this component's first refactor-convergence target once the shared one exists.

## Epic context
- Parentless design-system feature — consumed cross-epic. First dependent:
  `playout-admin-redesign-honest-actions`.

## Design decisions
- **Controlled component, not imperative promise hook**: `<ConfirmDialog open ...>`
  driven by consumer pending-state, matching the revoke-dialog precedent in the creator
  streaming page and the Ark controlled idiom. Rejected: `useConfirm()` promise API —
  ergonomic for replacing `window.confirm` one-liners but requires an app-wide context
  provider; revisit if confirm sites proliferate past ~5 and the pending-state
  boilerplate starts hurting.
- **Consumer-owned async**: `onConfirm: () => void` — both adoption sites close the
  dialog first, then run the action (their existing shape). Optional `isPending`
  disables both buttons for future consumers that confirm-in-place (the
  honest-actions channel delete is the known candidate).
- **`role="alertdialog"` + initial focus on Cancel**: zag dialog v1.39.1 supports both
  via `DialogRoot` prop passthrough (`role`, `initialFocusEl` verified in
  `dialog.types.d.ts`). Focusing the non-destructive action is the safe default for
  destructive confirms.
- **Buttons come from `ui/Button`**: confirm button `variant="danger"` when
  `tone="danger"` (the default), `variant="primary"` when `tone="default"` (the
  honest-actions create-warning shape); cancel is `variant="secondary"`. The bespoke
  `.revokeConfirmButton`/`.revokeCancelButton` CSS in the creator streaming module is
  deleted at convergence.
- **`confirmLabel` is required, no "OK" default**: confirm buttons name the consequence
  ("Revoke key", "Delete destination") — a generic default would invite lazy call
  sites.
- **Consequence message is the `children` slot** (per the brief): rich content allowed
  (quoted names, emphasis), rendered inside `DialogDescription`.
- **Adoption is in scope here** (unlike the table primitive): the brief names the
  sites — (1) simulcast destination delete replaces `window.confirm`, closing
  `bug-admin-simulcast-window-confirm` (delete the backlog stub in the same story);
  (2) the creator key-revoke local DialogRoot confirm converges onto the shared
  component. `playout-admin-redesign-honest-actions` adopts in its own feature.

## Architectural choice
A thin controlled composition over the existing `ui/dialog.tsx` Ark wrappers + `ui/Button`
— no new dialog mechanics, just the confirm-specific opinionated layer (alertdialog role,
cancel-first focus, consequence slot, danger styling, label discipline). Alternatives:

1. **Imperative `useConfirm()` promise hook** — rejected (see Design decisions; provider
   cost, diverges from the controlled precedent).
2. **Inline confirm row** (the backlog item's first suggestion: "Confirm delete?" row
   under the item) — rejected: doesn't generalize to the create-warning case, duplicates
   per-surface layout work, and the platform already has an accessible dialog stack; the
   epic design promoted a *dialog* component.
3. **Controlled `ConfirmDialog` composition** — chosen.

## Implementation Units

### Unit 1: `ConfirmDialog` component
**File**: `apps/web/src/components/ui/confirm-dialog.tsx`
**Story**: `shared-confirm-dialog-component-component`

```tsx
import type { ReactNode } from "react";

export interface ConfirmDialogProps {
  /** Controlled open state. */
  readonly open: boolean;
  /** Dialog heading, e.g. "Revoke key?". */
  readonly title: string;
  /** Consequence message — what happens if the user proceeds. */
  readonly children: ReactNode;
  /** Confirm button text — name the consequence ("Revoke key"). Required, no default. */
  readonly confirmLabel: string;
  /** Cancel button text. Default "Cancel". */
  readonly cancelLabel?: string;
  /** "danger" (default): confirm button is destructive-styled. "default": primary. */
  readonly tone?: "danger" | "default";
  /** Disables both buttons while a confirm-in-place action runs. */
  readonly isPending?: boolean;
  /** Called when the user confirms. Async/error handling is consumer-owned. */
  readonly onConfirm: () => void;
  /** Called on cancel, Escape, or backdrop dismiss. */
  readonly onCancel: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps): React.ReactElement;
```

**Implementation Notes**:
- Compose `DialogRoot` (with `role="alertdialog"`, `lazyMount`, `unmountOnExit`,
  `open`, `onOpenChange` → fire `onCancel` when `details.open` is false and the close
  wasn't the confirm click — simplest correct form: track nothing, call `onCancel`
  on every close; consumers already null their pending state idempotently),
  `DialogBackdrop`, `DialogContent`, `DialogTitle`, `DialogDescription` (wraps
  `children`), and a `.actions` row of two `Button`s.
- `initialFocusEl={() => cancelRef.current}` on `DialogRoot`; `cancelRef` via `useRef`
  on the cancel Button (Button is polymorphic — verify it forwards refs; if it does not,
  use a plain ref callback on the underlying element or extend Button with forwardRef as
  part of this unit).
- Confirm click calls `onConfirm()` only — it does NOT also fire `onCancel`; consumers
  close by clearing their pending state in `onConfirm`.
- `isPending` sets `disabled` on both buttons.
- Small module CSS: `.actions` flex row (gap token, right-aligned), confirm-first order
  matching the revoke precedent.

**Acceptance Criteria**:
- [ ] Renders title, consequence children, confirm + cancel buttons with given labels.
- [ ] `tone="danger"` (default) → confirm Button `data-variant="danger"`;
      `tone="default"` → `data-variant="primary"`; cancel is `data-variant="secondary"`.
- [ ] Confirm click fires `onConfirm` exactly once and does not fire `onCancel`.
- [ ] Cancel click fires `onCancel`.
- [ ] `isPending` disables both buttons.
- [ ] Dialog content carries `role="alertdialog"`.
- [ ] Strict-mode clean (`exactOptionalPropertyTypes`).

### Unit 2: Simulcast delete adoption
**File**: `apps/web/src/components/simulcast/simulcast-destination-manager.tsx`
**Story**: `shared-confirm-dialog-component-simulcast-adoption`

**Implementation Notes**:
- Replace `window.confirm` in `handleDelete` (line ~158) with pending-state:
  `const [destPendingDelete, setDestPendingDelete] = useState<SimulcastDestination | null>(null)`.
  Delete buttons set the pending destination; `<ConfirmDialog>` at component foot with
  `title="Delete destination?"`, consequence message naming the destination label and
  that simulcasting to it stops, `confirmLabel="Delete destination"`, `onConfirm` clears
  pending then runs the existing delete+reload, `onCancel` clears pending.
- Hits BOTH admin (`variant="table"`) and creator (`variant="list"`) surfaces — the
  dialog renders once outside the variant branch.
- Add delete-flow tests to
  `apps/web/tests/unit/components/simulcast-destination-manager.test.tsx` (delete mock
  exists but no test exercises the flow today): click Delete → dialog appears →
  confirm calls `deleteDestination`; cancel does not.
- Delete `.work/backlog/bug-admin-simulcast-window-confirm.md` in this story's commit
  (the fix it tracks lands here).

**Acceptance Criteria**:
- [ ] No `window.confirm` remains in the component.
- [ ] Confirm deletes and reloads; cancel leaves the destination untouched.
- [ ] Backlog stub removed.

### Unit 3: Creator key-revoke convergence
**File**: `apps/web/src/routes/creators/$creatorId/manage/streaming.tsx`
**Story**: `shared-confirm-dialog-component-revoke-convergence`

**Implementation Notes**:
- Replace the local `DialogRoot`-based revoke confirm (lines ~357–388) with
  `<ConfirmDialog open={keyPendingRevoke !== null} title="Revoke key?"
  confirmLabel="Revoke key" ...>` keeping the existing consequence sentence and the
  existing `keyPendingRevoke` state shape.
- Remove now-unused dialog imports and the `.revokeDialogActions` /
  `.revokeConfirmButton` / `.revokeCancelButton` rules from `streaming.module.css`.
- Update the route's existing tests if they assert on the old button classes/structure.

**Acceptance Criteria**:
- [ ] Revoke flow behavior unchanged (open on Revoke, confirm revokes, cancel/Escape
      dismisses).
- [ ] Bespoke confirm CSS and local dialog markup gone.

---

## Implementation Order
1. `shared-confirm-dialog-component-component` (Unit 1 + its tests)
2. `shared-confirm-dialog-component-simulcast-adoption` and
   `shared-confirm-dialog-component-revoke-convergence` — parallel, both depend on 1.

## Testing
### Unit Tests: `apps/web/tests/unit/components/confirm-dialog.test.tsx`
@testing-library/react + user-event per existing ui tests; Ark dialog portals render
into jsdom body — query via `screen`. Cover every Unit 1 acceptance criterion;
`initialFocusEl` focus assertion if jsdom honors it (zag focus management may need
`await waitFor`) — drop to a smoke assertion if flaky rather than faking it.
Adoption-site tests live with their stories (Units 2–3).

## Risks
- **Button ref forwarding unknown** — `initialFocusEl` needs a DOM ref to the cancel
  button; if `ui/Button` doesn't forward refs, extending it with `forwardRef` is in
  Unit 1's scope (behavior-neutral addition).
- **`onOpenChange` double-fire on confirm** — confirm clears consumer state, which
  flips `open` and triggers `onOpenChange(false)` → `onCancel`. Consumers' `onCancel`
  (clear pending state) is idempotent, so this is harmless; the component contract
  documents that `onCancel` may fire after `onConfirm` and must be safe to call when
  already closed.
- **Lane overlap**: `playout-admin-redesign-honest-actions` (this lane, later) and the
  unified-channel-model epic touch admin playout surfaces; this feature's adoption
  sites (simulcast manager, creator streaming route) are outside those write sets.
