---
id: shared-confirm-dialog-component
kind: backlog
tags: [design-system]
created: 2026-06-12
---

# Design-system: shared confirm-dialog component

UX-review cross-surface finding (2026-06-12): destructive actions either confirm via
bare `window.confirm` (simulcast destination delete — shared component, hits admin AND
creator surfaces; filed `bug-admin-simulcast-window-confirm`) or don't confirm at all
(stream-key revoke — `creator-key-revoke-confirmation` story). Build one accessible
confirm dialog (Ark UI Dialog base, design tokens, consequence-message slot, focus
management) and adopt it at the three known sites. Consumers waiting:
`creator-key-revoke-confirmation`, the simulcast managers, `playout-admin-redesign`.
