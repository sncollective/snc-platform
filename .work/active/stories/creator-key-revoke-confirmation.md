---
id: creator-key-revoke-confirmation
kind: story
stage: implementing
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
- [ ] Revoke requires explicit confirmation naming the key and the consequence
- [ ] Dialog is keyboard/screen-reader accessible
- [ ] Test covers confirm and cancel paths
