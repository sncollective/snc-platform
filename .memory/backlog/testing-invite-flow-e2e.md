---
tags: [testing, identity]
release_binding: null
created: 2026-04-21
---

# Testing: invite flow e2e coverage

Verify golden-path e2e coverage for two invite journeys:

1. Admin-invites-creator: admin creates invite → email token → accept page → creator profile created → lands in manage settings.
2. Creator-invites-team-member: owner creates invite → accept page → team membership added.

Relevant files: `apps/api/src/routes/invite.routes.ts`, `apps/api/src/services/invites.ts`, `apps/web/src/routes/invite/$token.tsx`, `apps/web/src/routes/admin/creators.tsx`, `apps/web/src/components/creator/team-section.tsx`.

Forwarded from feature/release-0.2.2 (2026-04-11).
