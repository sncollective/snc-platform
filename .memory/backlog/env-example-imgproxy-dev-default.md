---
tags: [developer-experience, design-system]
release_binding: null
created: 2026-04-20
---

# .env.example: enable imgproxy by default in dev

In [platform/.env.example](../../.env.example), the `IMGPROXY_URL` line is commented out inside a block that groups it with `IMGPROXY_KEY` + `IMGPROXY_SALT` (production signing secrets). A fresh clone + `cp .env.example .env` (the devcontainer's postCreate default) leaves the dev API returning `thumbnail: null` / `avatar: null` / `banner: null` and the web app silently falling back to the legacy proxy routes. New devs don't see responsive images until they know to uncomment one specific line.

Surfaced 2026-04-20 during `responsive-images` review: the "all thumbs missing" regression when the user uncommented `IMGPROXY_URL` was a symptom of the broader discoverability gap — dev needs imgproxy on, prod needs signing, grouping the three under one "optional" block hides that distinction.

## Proposed shape

Split the existing block into two sections:

```
# ── imgproxy (dev default: on; prod: set signing keys) ──

IMGPROXY_URL=http://localhost:8081

# ── imgproxy signing (prod only) ──
# IMGPROXY_KEY=               # hex-encoded HMAC key
# IMGPROXY_SALT=              # hex-encoded HMAC salt
```

With `IMGPROXY_URL` uncommented, the dev container's `snc-imgproxy` service (already auto-started by docker-compose, already port-forwarded on 8081 as of 2026-04-20) handles image processing by default. Empty key/salt in dev is correct per feature spec — URL builder uses the `unsafe` prefix.

Prod deploys must explicitly set `IMGPROXY_KEY` and `IMGPROXY_SALT` to enable signed URLs (blocks hotlinking + prevents processing abuse).

## Verification when picked up

- [ ] Fresh `cp .env.example .env` produces a dev env with `IMGPROXY_URL` set
- [ ] `curl http://localhost:3000/api/creators?limit=1` returns populated `avatar` field out of the box
- [ ] New section header makes prod-signing requirement discoverable without reading the feature spec
