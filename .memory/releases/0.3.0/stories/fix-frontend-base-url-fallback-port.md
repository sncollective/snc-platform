---
id: story-fix-frontend-base-url-fallback-port
kind: story
stage: done
tags: [content, refactor]
release_binding: 0.3.0
created: 2026-04-24
updated: 2026-04-24
related_decisions: []
related_designs: []
parent: null
---

Surfaced by the 0.3.0 refactor-gate scan (api/infra). [`getFrontendBaseUrl()`](../../apps/api/src/lib/route-utils.ts) falls back to `http://localhost:3001` when `CORS_ORIGIN` is not set, but the web app actually runs on `:3080` (per AGENTS.md and `config.ts`'s own `CORS_ORIGIN` default). If any deployment path reaches the fallback — misconfigured env, local smoke test with unset `CORS_ORIGIN` — the helper returns a URL pointing at a port nothing serves.

Affects every caller that builds frontend-bound URLs: Stripe checkout redirects, post-login navigation, and (once [`fix-invite-email-frontend-url`](fix-invite-email-frontend-url.md) lands) invite email links.

## What changes

[apps/api/src/lib/route-utils.ts:9](../../apps/api/src/lib/route-utils.ts#L9):

```ts
// before
return firstOrigin ?? 'http://localhost:3001';

// after
return firstOrigin ?? 'http://localhost:3080';
```

Align with `CORS_ORIGIN`'s own default at [config.ts](../../apps/api/src/config.ts) and with `pm2`'s documented web port. Also add a concise JSDoc explaining the derivation so the next contributor doesn't re-split the default.

## Tasks

- [ ] Change the fallback string to `'http://localhost:3080'`.
- [ ] Add `/** Derive the frontend base URL from the first configured CORS origin. Used to construct redirect URLs for external flows (Stripe checkout, OAuth callbacks, invite emails). */` JSDoc.
- [ ] Grep for other `localhost:3001` references in `apps/api/src` to confirm this is the only mismatch.

## Verification

- Unit test: call `getFrontendBaseUrl()` with `CORS_ORIGIN` unset; assert the returned value is `http://localhost:3080`.

## Risks

None. The current fallback is documented-wrong; changing it can only reduce the chance of a misconfigured deployment serving broken redirects.
