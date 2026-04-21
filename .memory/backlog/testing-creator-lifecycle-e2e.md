---
tags: [testing, streaming, creators]
release_binding: null
created: 2026-04-21
---

# Testing: creator lifecycle e2e coverage

Verify golden-path e2e coverage for the creator lifecycle flows: creator listing shows only active creators, creator detail returns 404 for inactive/archived creators, content feed excludes non-active creator content, and admin creator CRUD operations.

Relevant files: `apps/api/src/routes/creator.routes.ts`, `apps/api/src/routes/admin-creators.routes.ts`, `apps/api/src/routes/content.routes.ts`.

Forwarded from feature/release-0.2.1 (2026-04-02).
