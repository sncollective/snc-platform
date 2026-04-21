---
tags: [documentation, identity]
release_binding: null
created: 2026-04-20
---

# Manage Area Access Model — Docs Coverage Check

Check docs coverage for the updated manage area gating: team membership OR admin (not stakeholder). The stakeholder role is now governance-only, no longer a manage gate. Cover `canManage` semantics in API responses.

Relevant files: `apps/web/src/routes/creators/$creatorId/manage.tsx`, `apps/api/src/routes/creator.routes.ts`.

Forwarded from feature/release-0.2.2 (2026-04-11). Target audience: developers reviewing agent work or contributing manually.
