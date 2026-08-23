---
id: emissions-public-page-500
kind: story
stage: backlog
tags: [bug, emissions, identity]
parent: null
depends_on: []
release_binding: null
gate_origin: found during public-screen inventory 2026-08-15
created: 2026-08-15
---

# Public emissions page 500s for logged-out visitors

`/emissions` (the public carbon-transparency page) SSR-fetches `/api/emissions/breakdown`,
which returns 401 without a session — the loader throws and the page renders a 500 instead
of the transparency data. Reproduced with the API freshly restarted (not env flake).

Fix direction: the breakdown endpoint should be public (transparency is the page's purpose)
or the route should degrade gracefully (summary without breakdown). Confirm intended
auth model before opening the endpoint.

## Resolution (2026-08-15, operator)

Not a bug — the emissions page is INTENTIONALLY DOWN pending a more robust ledger/
representation rebuild (operator decision). The 500 was the down-state leaking: web flag
defaulted on while the API endpoint stayed stakeholder-gated.

Mechanism now: `VITE_FEATURE_EMISSIONS=false` in ecosystem web env (matches web-staging's
existing matrix) + `FEATURE_EMISSIONS=false` in dev .env. Nav link hides; direct /emissions
renders the designed `ComingSoon` component; API routes unregistered. Auth model question is
moot — reads stay gated until the rebuild decides the transparency surface's shape.
Reopen when the ledger rebuild work starts.
