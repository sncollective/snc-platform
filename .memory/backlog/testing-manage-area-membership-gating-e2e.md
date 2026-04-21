---
tags: [testing, creators]
release_binding: null
created: 2026-04-21
---

# Testing: manage area membership gating e2e coverage

Verify golden-path e2e coverage for the updated `beforeLoad` guard on `/creators/$creatorId/manage`: non-member non-admin receives AccessDeniedError, team members (owner/editor/viewer) get access, admin still bypasses membership check, and the "Manage" link visibility on the creator header matches the `canManage` flag.

The guard was changed from stakeholder/admin to team-membership OR admin in feature/release-0.2.2.

Relevant files: `apps/web/src/routes/creators/$creatorId/manage.tsx`, `apps/api/src/routes/creator.routes.ts`.

Forwarded from feature/release-0.2.2 (2026-04-11).
