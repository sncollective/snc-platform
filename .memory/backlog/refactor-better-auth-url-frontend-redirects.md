---
tags: [refactor, access-model, streaming]
release_binding: null
created: 2026-04-24
---

# Audit + fix `BETTER_AUTH_URL` usage at frontend-bound sites

During the 0.3.0 refactor-gate, [fix-invite-email-frontend-url](../archive/TODO-when-released/) addressed one case where `config.BETTER_AUTH_URL` was used to build a user-facing frontend URL (the invite accept link) instead of the frontend hostname. The same anti-pattern exists at 5 other sites that were out of scope for the single-story fix:

- [streaming-connect.routes.ts:94](../../apps/api/src/routes/streaming-connect.routes.ts#L94) — Twitch callback error redirect to `/login`
- [streaming-connect.routes.ts:114](../../apps/api/src/routes/streaming-connect.routes.ts#L114) — Twitch success redirect to `/creators/<id>/manage/streaming`
- [streaming-connect.routes.ts:174](../../apps/api/src/routes/streaming-connect.routes.ts#L174) — YouTube error redirect to `/login`
- [streaming-connect.routes.ts:194](../../apps/api/src/routes/streaming-connect.routes.ts#L194) — YouTube success redirect to `/creators/<id>/manage/streaming`
- [streaming.routes.ts:335](../../apps/api/src/routes/streaming.routes.ts#L335) — `liveUrl` embedded in go-live notification payload
- [mastodon-auth.routes.ts:87](../../apps/api/src/routes/mastodon-auth.routes.ts#L87) — redirect to `BETTER_AUTH_URL` root after Mastodon OAuth callback

## Why it's latent (not immediate)

In dev and in deployments where `BETTER_AUTH_URL` and `CORS_ORIGIN[0]` happen to resolve to the same host, these redirects work. The SNC production deployment at the time this was parked is believed to run API + web on the same hostname, so the bug is dormant. It surfaces when a future deployment splits API and web onto separate hostnames — Twitch/YouTube OAuth connect would redirect to `api.example.com/creators/...` instead of `web.example.com/creators/...` and 404.

## Fix shape

Same as the invite fix: replace `${config.BETTER_AUTH_URL}` with `${getFrontendBaseUrl()}` from [lib/route-utils.ts](../../apps/api/src/lib/route-utils.ts). Mechanical across all 6 sites. The `mastodon-auth.routes.ts` case also needs a revisit of the `cookieDomain = new URL(BETTER_AUTH_URL).hostname` logic (line 82) — in a split-host setup, the session cookie must be scoped to a parent domain shared between API and web, which `BETTER_AUTH_URL`'s hostname alone doesn't convey.

## Scope sketch for `/scope`

Likely one feature with inline tasks per site, since all fixes are trivial but the Mastodon cookie-scope case needs a design note. Shape A.

## Revisit if

- API and web are split onto different hostnames in any deployment.
- Federation or admin subdomain plans land (which would force the split).
- Another auth-flow finding surfaces the same anti-pattern elsewhere.
