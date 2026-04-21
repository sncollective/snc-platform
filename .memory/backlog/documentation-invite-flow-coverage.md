---
tags: [documentation, identity]
release_binding: null
created: 2026-04-20
---

# Invite Flow — Docs Coverage Check

Check docs coverage for the invite token lifecycle (create → hash → email → validate → accept), two invite types (`creator_owner`, `team_member`), 7-day expiry, email match check, and SMTP requirement for production.

Relevant files: `apps/api/src/services/invites.ts`, `apps/api/src/email/templates/invite.ts`, `apps/api/src/routes/invite.routes.ts`.

Forwarded from feature/release-0.2.2 (2026-04-11). Target audience: developers reviewing agent work or contributing manually.
