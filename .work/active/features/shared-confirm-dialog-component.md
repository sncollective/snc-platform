---
id: shared-confirm-dialog-component
kind: feature
stage: drafting
tags: [design-system]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-12
updated: 2026-06-12
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
