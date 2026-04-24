---
id: story-fix-invite-email-frontend-url
kind: story
stage: done
tags: [access-model, community]
release_binding: 0.3.0
created: 2026-04-24
updated: 2026-04-24
related_decisions: []
related_designs: []
parent: null
---

Surfaced by the 0.3.0 refactor-gate scan (api/infra). The invite accept URL in the creator/team-member invite email is built with `config.BETTER_AUTH_URL` — the API server hostname in prod — instead of the frontend URL. In dev both values happen to be `http://localhost:3080` so the bug is invisible; in prod where API and web run on different hostnames, invite links 404.

Directly collides with the 0.3.0 bundle's prod-verification line: **"send a creator_owner invite and a team_member invite to real inboxes via prod SMTP; accept flow completes end-to-end for both types."** Ships broken unless fixed.

## What changes

[apps/api/src/email/templates/invite.ts:16](../../apps/api/src/email/templates/invite.ts#L16) currently:

```ts
const acceptUrl = `${config.BETTER_AUTH_URL}/invite/${inviteToken}`;
```

Replace with a call through `getFrontendBaseUrl()` (already exported from [lib/route-utils.ts](../../apps/api/src/lib/route-utils.ts)):

```ts
import { getFrontendBaseUrl } from "../../lib/route-utils.js";
// ...
const acceptUrl = `${getFrontendBaseUrl()}/invite/${inviteToken}`;
```

`getFrontendBaseUrl()` derives from the first configured `CORS_ORIGIN`, which matches the deployed web hostname. Same fix applies to any sibling email template that constructs frontend URLs via `BETTER_AUTH_URL` — audit `email/templates/` for the pattern during the fix.

## Tasks

- [ ] Replace `BETTER_AUTH_URL` usage in `invite.ts` with `getFrontendBaseUrl()` call.
- [ ] Grep `email/templates/` for other `BETTER_AUTH_URL` usages; replace where the URL is user-facing frontend-bound (not auth-callback-bound).
- [ ] Confirm `getFrontendBaseUrl()` fallback is correct after the `:3001 → :3080` fix lands (see sibling story `fix-frontend-base-url-fallback-port`). Order of these two stories matters: land the fallback fix first so the invite fix inherits a correct default.
- [ ] Unit test: assert invite email body contains a URL prefixed with the frontend base, not the API base, when the two configs differ.

## Verification

- Set `BETTER_AUTH_URL=http://api.example.test` and `CORS_ORIGIN=http://web.example.test`; generate an invite email and verify the URL uses `web.example.test`.
- Mailpit smoke test in dev still resolves the URL correctly (dev values haven't diverged; URL still points at `:3080`).

## Risks

Low — `getFrontendBaseUrl()` is already in use elsewhere (checkout redirects). This extends its use to the email template path.
