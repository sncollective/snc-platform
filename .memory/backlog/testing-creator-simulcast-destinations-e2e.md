---
tags: [testing, streaming]
release_binding: null
created: 2026-04-21
---

# Testing: creator simulcast destinations e2e coverage

Verify golden-path e2e coverage for the creator manage streaming page simulcast section: section is visible to owners, CRUD operations work, and cap enforcement is applied. Tests should confirm that non-owners do not see the simulcast section.

Relevant files: `apps/web/src/routes/creators/$creatorId/manage/streaming.tsx`, `apps/api/src/routes/streaming.routes.ts`.

Forwarded from feature/s-nc-tv (2026-03-31).
