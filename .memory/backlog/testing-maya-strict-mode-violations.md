---
tags: [testing]
release_binding: null
created: 2026-04-21
---

# Testing: Maya strict-mode selector violations (2026-04-15 CI run)

Two chromium failures caused by over-broad selectors that now resolve ambiguously when the stakeholder fixture is Maya:

1. `navigation.spec.ts:6` — `page.getByText("Maya Chen").first()` resolves to the user-menu `_userName_` span inside a closed dropdown, causing a click timeout.
2. `creator-manage.spec.ts:6` — same collision on `/creators/maya-chen/manage`.

Fix: scope selectors to the main content region or use `getByRole('link', { name: /Maya Chen/ })` to avoid matching the closed dropdown. Narrow, targeted test-side fix — can land during any next testing pass.

Surfaced in the 2026-04-15 first real CI exercise (27/109 failures, typecheck-gap Phase D).
