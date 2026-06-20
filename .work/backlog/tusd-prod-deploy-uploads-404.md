---
id: tusd-prod-deploy-uploads-404
tags: [deploy, content, media-pipeline, user-station]
release_binding: null
created: 2026-06-19
---

# Resumable uploads return 404 on prod — tusd is not deployed

## Symptom

Creators uploading content (audio / playout media) on prod get a tus client error:

```
tus: unexpected response while creating upload, originated from request
(method: POST, url: /uploads/, response code: 404, response text: 404 Not Found)
```

The tus client POSTs to `/uploads/` to create a resumable upload and the prod
edge returns 404. Reproduces for any `content-media` / `playout-media` upload
(the two purposes that route through tus; thumbnails/avatars/banners go through
S3 multipart and are unaffected).

## Root cause

Resumable uploads are served by a **separate `tusd` container** (`snc-tusd`,
`tusproject/tusd:v2.9.2`), not by the API. The upload only works if something
routes `/uploads/*` to that container. That routing exists in dev and is absent
(and structurally wrong) on prod:

- **Dev:** `Caddyfile.dev` routes `/uploads/* → localhost:8070` (the tusd
  container's published port). tusd serves `-base-path=/uploads/`. Works.
- **Prod:** `deploy/Caddyfile.prod.example` routes `/uploads/* → APP_IP:3000`
  (the API) in both the `s-nc.org` and `s-nc.tv` blocks. But the API
  (`apps/api/src/app.ts`) mounts only `/api/uploads` and `/api/tusd/hooks` —
  there is **no `/uploads/*` route**, so Hono returns 404. That is the 404 the
  client surfaced.

And the deeper problem: **tusd is not deployed to prod at all.** `tusd` is only
defined in `docker-compose.yml`. Prod runs the app as systemd units
(`deploy/snc-api.service.example`, `snc-web.service.example`), which do not bring
up the docker stack. So even repointing the Caddy line to `:8070` would hit
nothing listening.

The app code is correct. This is a prod-infra gap, not a code bug.

## Why it slipped through

tus shipped in 0.3.0. The local round-trip was verified in dev (4GB HEVC: upload
→ rename → probe → transcode → playback), but the 0.3.0 prod-verification
checklist never listed a tus upload, so the first real exercise of `/uploads/`
on prod was a creator hitting the 404.

## Fix (three parts, all prod-infra — user at station)

1. **Run tusd on the prod host.** Same image/flags as
   `docker-compose.yml:129-163`, pointed at prod Garage, with:
   - `-hooks-http=<prod-API>/api/tusd/hooks` — the dev value
     `host.docker.internal:3000` is dev-only. On a systemd host, point it at the
     API's reachable address (loopback if co-located).
   - `-cors-allow-origin` set to the prod origins (`https://s-nc.org`,
     `https://s-nc.tv`) — currently `https?://localhost(:\d+)?`, dev-only.
   - prod Garage S3 creds + endpoint.
   A drafted systemd unit lives at `deploy/snc-tusd.service.example` (or run it
   as a one-off container on the host).

2. **Repoint Caddy.** `/uploads/* → tusd` (its prod host:port, e.g. `:8070`),
   not `APP_IP:3000`, in **both** the `s-nc.org` and `s-nc.tv` blocks of the prod
   Caddyfile. Updated example committed to `deploy/Caddyfile.prod.example`.

3. **CORS + body limits.** Confirm the prod Caddy `request_body { max_size 10MB }`
   that fronts `/uploads/*` does not clip tus chunk PATCHes (tus chunks are bounded
   by the client `chunkSize`, currently `MULTIPART_CHUNK_SIZE` in
   `apps/web/src/contexts/upload-context.tsx` — verify it stays under the Caddy
   cap, or exempt `/uploads/*` from the body limit). tusd's own `-max-size` is
   20GB.

## Fold in: deferred S1 security caveat

Exposing tusd in prod is the moment the **deferred 0.3.0 security S1 "tusd hooks
network auth"** matters. The hook endpoint (`/api/tusd/hooks`) currently has no
network auth — once tusd is reachable in prod, lock the hook path to tusd's
source (loopback-only bind, firewall rule, or a shared secret on
`-hooks-http-forward-headers`). Do not ship tusd to prod with the hook open.

## Acceptance

- [ ] tusd runs on the prod host (systemd unit or managed container), pointed at
      prod Garage, with prod CORS origins and the prod hook URL.
- [ ] Prod Caddy routes `/uploads/*` to tusd in both site blocks.
- [ ] A creator can complete a `content-media` upload on prod end-to-end:
      `/uploads/` POST → tus PATCH chunks → post-finish hook → canonical rename →
      probe/transcode → playback. (Mirror the dev round-trip.)
- [ ] tusd hook endpoint is not reachable from outside the host / is
      authenticated (closes the deferred S1).
- [x] Next-release `## Prod verification` gains a tus upload check so this can't
      regress unobserved again — added to the 0.4.0 release file
      (`Resumable (tus) uploads on prod`, gated on this item landing).

## Notes

- Could not verify the prod host or the parent-repo Forgejo `Deploy Production`
  workflow from the platform submodule — it's conceivable (but unlikely on the
  evidence) tusd was hand-provisioned on the box outside the repo. Confirm host
  state before/while applying.
- Tabled for the next release (not an emergency hotfix). Drafted prod artifacts
  are committed alongside this item so the deploy is mechanical when scheduled.
