---
tags: [security, batch-tracker]
release_binding: null
created: 2026-04-24
---

# Security-scan findings batch — 2026-04-24 (0.3.0 gate)

Batch-tracker for the S1/S2/S3 security findings surfaced during the 0.3.0 security-gate scan (full-codebase, 10 rules, 5 scan groups, ~250 files) that were **not bound to 0.3.0** as release blockers. Five high-severity findings were bound and fixed fix-in-flight; everything below is deferred.

The bound-and-fixed set: security-chat-moderation-rest-role-check, security-emissions-public-endpoints-auth, security-mastodon-ssrf-instance-domain, security-notification-action-url-open-redirect, security-email-template-html-injection (all at `active/stories/`, stage `done`, bound 0.3.0).

Infra/deploy-domain findings go to root `.memory/backlog/` per tag-taxonomy (see sibling items).

## Deferred S1 — high-severity but needing design / complex scope

### tusd /hooks endpoint missing network-auth guard
[tusd-hooks.routes.ts:209](../../apps/api/src/routes/tusd-hooks.routes.ts#L209) — any caller that can reach the API can POST to `/api/tusd/hooks`. The handler re-authenticates from forwarded session headers, so exploitation requires a valid user session. But the endpoint should have a shared-secret gate analogous to `verifySrsCallback` to prevent probing. Fix needs `TUSD_HOOK_SECRET` config, tusd-side config to forward it, and a middleware. Design-level work.

### Playout track-event callback secret — timing-safe + prod-required
[playout-channels.routes.ts:124-128](../../apps/api/src/routes/playout-channels.routes.ts#L124-L128) — uses `!==` string compare (timing leak) and silently bypasses the check when `PLAYOUT_CALLBACK_SECRET` is unset. Mirrors the SRS callback pattern that `security-srs-callback-secret-required-prod` backlog item covers — scope this together with or fold into that item.

### Multipart sign-part + list-parts + abort missing ownership check
[upload.routes.ts:208-248](../../apps/api/src/routes/upload.routes.ts#L208-L248) — any authenticated user with a guessed/leaked `uploadId` can sign parts, list parts, or abort another user's upload. Extends the existing `security-s3-multipart-ownership-recheck` backlog item to cover the full multipart surface. Needs an `uploadId`-to-owner store; complex.

## Deferred S2 — backlog (code domain)

### Auth / authorization
- **OIDC `requirePKCE: false`** — [auth.ts:116](../../apps/api/src/auth/auth.ts#L116). Needs PKCE support verification on Seafile + any other OIDC clients.
- **`requireEmailVerification: false`** — [auth.ts:92](../../apps/api/src/auth/auth.ts#L92). Sensitive ops (invite-accept, stream-key create, content publish) possible with unverified email. Either flip global flag or add a `requireVerifiedEmail` middleware to specific routes.
- **Simulcast stream keys stored plaintext in DB** — [simulcast.ts:100+198](../../apps/api/src/services/simulcast.ts). Twitch/YouTube RTMP keys should be encrypted at rest. Needs key-management decision.

### Rate limiting / CSRF-state memory
- **Mastodon OAuth start has no rate limit** — [mastodon-auth.ts:48-118](../../apps/api/src/services/mastodon-auth.ts#L48-L118). Registration spam against external instances.
- **Twitch/YouTube OAuth start has no rate limit** — [streaming-connect.ts:49+204](../../apps/api/src/services/streaming-connect.ts). Unbounded in-memory `stateStore` growth.
- **CSRF `stateStore` has no size cap** — Mastodon (line 49) and streaming-connect. Add LRU eviction + `cleanExpiredStates` interval sanity check.

### Audit-log gaps
- **Invite create / accept** — [invite.routes.ts:23-67+102-132](../../apps/api/src/routes/invite.routes.ts). No structured `event=invite_created/accepted` log.
- **Invite email mismatch** — [invites.ts:144-219](../../apps/api/src/services/invites.ts#L144-L219). `INVITE_EMAIL_MISMATCH` rejection path should log for security monitoring.
- **Stream-key create/revoke** — [stream-keys.ts:59-85](../../apps/api/src/services/stream-keys.ts#L59-L85).
- **Creator-member CRUD** — [creator-members.routes.ts:119-184+187-243+247-317](../../apps/api/src/routes/creator-members.routes.ts). Add/update-role/remove all unaudited.

### Error / PII exposure
- **User email logged plaintext in notification-send** — [notification-send.ts:78+86](../../apps/api/src/jobs/handlers/notification-send.ts). Hash or truncate.
- **Webhook handler logs PII fields** — [webhook.routes.ts:47-51](../../apps/api/src/routes/webhook.routes.ts#L47-L51). `handleCheckoutCompleted` logs raw `userId/planId/stripeSubscriptionId/stripeCustomerId` on missing-metadata path.
- **Local storage error messages leak filesystem paths** — [local-storage.ts:31-33](../../apps/api/src/storage/local-storage.ts#L31-L33). Sanitize before `AppError.message`.
- **SMTP sendMail errors propagate unfiltered** — [email/send.ts:69](../../apps/api/src/email/send.ts#L69). Wrap in try/catch; re-throw generic AppError.
- **Raw instanceDomain in Mastodon error message** — [mastodon-auth.ts:97](../../apps/api/src/services/mastodon-auth.ts#L97). Use static message.

### Schema / validation gaps
- **8 missing param validators in playout-channels.routes.ts** — lines 84-105, 151-175, 218-245, 247-271, 275-299, 301-326, 328-359, 360-390. Mechanical; add `validator("param", z.object({...}))` to each.
- **Unbounded `CreateContentSchema.body` + `UpdateContentSchema.body`** — [packages/shared/src/content.ts:30+38](../../packages/shared/src/content.ts). Storage-exhaustion vector.
- **ReDoS in chat word filters** — [chat-word-filters.ts:155-159](../../apps/api/src/services/chat-word-filters.ts#L155-L159). User-supplied regex compiled per-message, no timeout. `safe-regex2` validation at creation time or worker-thread timeout at match time.

### Client-side
- **Error message passthrough to UI boundaries** — [RouteErrorBoundary](../../apps/web/src/components/error/route-error-boundary.tsx) and [RootErrorFallback](../../apps/web/src/routes/__root.tsx) render `error.message` directly. Use fixed strings; log the message instead.
- **Stream key embedded in displayed RTMP URL** — [manage/streaming.tsx:198-200](../../apps/web/src/routes/creators/$creatorId/manage/streaming.tsx#L198-L200). Consider showing key separately with copy button; also `autocomplete="off"` on key-name input line 208.
- **OIDC parameter passthrough from `window.location.search`** — [url.ts:13-18](../../apps/web/src/lib/url.ts#L13-L18). `getOidcAuthorizeUrl` forwards all query params to `/api/auth/oauth2/authorize` — possible OAuth parameter injection if server-side Better Auth doesn't strictly validate `redirect_uri`.

### Infra-code boundary
- **`GARAGE_ADMIN_TOKEN` weak prod default** — [config.ts:30](../../apps/api/src/config.ts#L30). `"dev-admin-token"` silently accepted in prod. Remove `.default()` + add startup guard.
- **imgproxy unsigned prod guard** — [imgproxy.ts:94-98+145-148](../../apps/api/src/lib/imgproxy.ts). Falls back to literal `"unsafe"` when keys absent; needs startup warn/error in prod.

## Deferred S3 — backlog (hardening)

- Chat moderation actions (ban/timeout/unban/slow-mode) — DB audit trail exists but no structured log event. [chat-moderation.ts:42-228](../../apps/api/src/services/chat-moderation.ts).
- Garage Admin API auth failures not tagged as security events — [cleanup-incomplete-uploads.ts:28-66](../../apps/api/src/jobs/handlers/cleanup-incomplete-uploads.ts).
- LIKE metacharacters not escaped in playout content search (perf/DoS, not injection) — [playout-orchestrator.ts:832-888](../../apps/api/src/services/playout-orchestrator.ts#L832-L888).
- Liquidsoap callback secret via query param (architectural constraint, log-level mitigated) — [liquidsoap-config.ts:60](../../apps/api/src/services/liquidsoap-config.ts#L60).

## Accepted risk (documented exceptions — not items)

- OAuth callback routes (Twitch, YouTube, Mastodon) correctly bypass `requireAuth` per documented exception; auth is via signed state.
- `POST /stripe` webhook uses signature verification per documented exception.
- Seed-demo credentials are intentional dev fixtures with production-env guard.
- Bun `audit` runs in `test-shared` CI job — covers whole workspace.
- `secureHeaders()` applied globally with strict CSP at [app.ts:62-70](../../apps/api/src/app.ts#L62-L70).
- Pino redact list covers `authorization`, `cookie`, `x-api-key` headers + request logger strips query strings.
- Local-storage `resolvePath()` has path-traversal protection.

## How to consume this

`/scope <topic>` to promote sub-clusters. Several of these overlap existing items: `security-srs-callback-secret-required-prod`, `security-rate-limit-auth-in-memory`, `security-s3-multipart-ownership-recheck`. Fold into those where applicable.

## Revisit if

- A deployment splits API and web onto different hostnames — triggers several of these (actionUrl, OIDC redirect, invite URL already fixed; others too).
- A future security-scan surfaces any of these moving from S2 to S1 exploitability (e.g., plaintext simulcast keys becoming S1 if DB encryption-at-rest isn't also added).
- Full-codebase re-scan produces &gt; 50% overlap with this list — the batch-tracker is no longer pulling its weight; promote directly to individual items on next pass.
