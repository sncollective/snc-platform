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
