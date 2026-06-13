---
id: creator-key-revoke-confirmation
kind: story
stage: review
tags: [streaming, creators]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
parent: null
---

# Confirm key revocation and state the consequence

UX-review finding (creator audit C2, severity 3): "Revoke" fires immediately — no
confirmation, no warning that streaming software using the key disconnects, and the
action is irreversible. Add a confirmation step that names the key and states the
consequence ("Revoking 'OBS Home' will disconnect any streaming software using it.
This cannot be undone."). Prefer the shared confirm-dialog component if
`shared-confirm-dialog-component` has landed by implementation time; otherwise a local
accessible dialog (Ark UI Dialog) — NOT `window.confirm`. Related a11y items already
filed: `a11y-creator-revoke-button-no-label`, `a11y-creator-revoke-button-focus`.

## Acceptance
- [x] Revoke requires explicit confirmation naming the key and the consequence
- [x] Dialog is keyboard/screen-reader accessible
- [x] Test covers confirm and cancel paths

## Implementation notes

**Changed files:**

- `apps/web/src/routes/creators/$creatorId/manage/streaming.tsx`:
  - Imported `DialogRoot`, `DialogBackdrop`, `DialogContent`, `DialogTitle`, `DialogDescription` from `../../../../components/ui/dialog.js`.
  - Added `keyPendingRevoke: { id: string; name: string } | null` state (initialized `null`).
  - Added `handleConfirmRevoke()` — reads `keyPendingRevoke`, clears it, then calls existing `handleRevoke(id, name)`.
  - Revoke button in active-keys list now calls `setKeyPendingRevoke({ id: key.id, name: key.name })` instead of `handleRevoke`. Button gains `aria-label={"Revoke key " + key.name}` — natural a11y fallout (covers filed items `a11y-creator-revoke-button-no-label`).
  - Added `DialogRoot` (controlled: `open={keyPendingRevoke !== null}`, `onOpenChange` clears on close) + `DialogBackdrop` + `DialogContent` with `DialogTitle` ("Revoke key?"), `DialogDescription` (names the key and consequence), and action buttons `<button type="button">Revoke key</button>` (destructive) + `<button type="button">Cancel</button>`.
  - Dialog uses `lazyMount unmountOnExit` matching the existing pattern in `follow-fediverse-dialog.tsx`.
- `apps/web/src/routes/creators/$creatorId/manage/streaming.module.css`:
  - Added `.revokeDialogActions`, `.revokeConfirmButton` (destructive: `background: var(--color-error)`, `:focus-visible` ring), `.revokeCancelButton` (neutral). No existing destructive button class found in project button modules — local class is correct per implementation notes.
- `apps/web/tests/unit/routes/creators/manage/streaming.test.tsx`:
  - Updated "lists active keys" test: Revoke button query now uses `aria-label` form `"Revoke key OBS Home"`.
  - Replaced "revokes a key and shows success message" test with two tests:
    - `"confirm path: ..."` — opens dialog, asserts dialog description text, clicks "Revoke key", asserts `revokeStreamKey` called and success message shown.
    - `"cancel path: ..."` — opens dialog, clicks "Cancel", asserts dialog closed and `revokeStreamKey` NOT called.
  - Added `mockCreateStreamKey.mockReset()` and `mockRevokeStreamKey.mockReset()` to `beforeEach` to prevent cross-test call-count bleed.

**Scoping note:** `shared-confirm-dialog-component` has not landed (backlog stub) — used the existing Ark UI Dialog wrappers directly per the story's fallback direction.

## Review (2026-06-12)

**Verdict**: Approve — held at review on fix-verify loopback (platform convention:
user re-confirms the fix in the running app before close). Fast lane: implementation
record green (full suite: 671 shared + 1501 api + 1607 web, typecheck clean); diff
spot-checked against the story brief at feature-level review.
