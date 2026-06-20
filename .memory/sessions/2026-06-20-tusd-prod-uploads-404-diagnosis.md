---
date: 2026-06-20
tags: [content, media-pipeline, deploy, streaming]
session_type: prod bug diagnosis → prod-deploy artifacts drafted → backlog item + release verification check
related_items:
  - tusd-prod-deploy-uploads-404
  - release-0.4.0
---

# Session: tus uploads 404 on prod — tusd never deployed

A creator hit `tus: unexpected response while creating upload … (method: POST, url:
/uploads/, response code: 404)` uploading audio on prod. Diagnosed it, drafted the prod-deploy
artifacts, and tracked it for the next release. No prod changes (can't reach the host); nothing
hotfixed.

## Root cause

Resumable uploads (`content-media` / `playout-media`) are served by a **separate `tusd`
container** (`snc-tusd`, `tusproject/tusd:v2.9.2`), never by the API. The upload only works if
something routes `/uploads/*` to that container. That routing is correct in dev and
broken-or-absent on prod:

- **Dev:** `Caddyfile.dev` routes `/uploads/* → localhost:8070` (tusd, `-base-path=/uploads/`). Works.
- **Prod:** `deploy/Caddyfile.prod.example` routed `/uploads/* → APP_IP:3000` (the API) in both
  the `s-nc.org` and `s-nc.tv` blocks. The API (`apps/api/src/app.ts`) mounts only
  `/api/uploads` + `/api/tusd/hooks` — no `/uploads/*` route → Hono 404. That's the client's 404.
- **Deeper:** `tusd` is only in `docker-compose.yml`. Prod runs the app as systemd units
  (`snc-api.service`, `snc-web.service`), which don't bring up the docker stack — so tusd isn't
  deployed to prod at all. Even repointing Caddy to `:8070` would hit nothing listening.

The app code is correct. This is a prod-infra gap from 0.3.0 (tus shipped then), and the 0.3.0
prod-verification checklist never listed a tus upload, so the first real exercise of `/uploads/`
on prod was this creator's 404.

## What I produced

All in the platform submodule:

- **`.work/backlog/tusd-prod-deploy-uploads-404.md`** (`[deploy, content, media-pipeline,
  user-station]`) — diagnosis, the three-part fix (run tusd on the prod host / repoint Caddy /
  CORS + body-limit), acceptance criteria, and the folded-in security caveat.
- **`deploy/snc-tusd.service.example`** — systemd unit running the pinned tusd image as a
  docker-managed unit (prod uses systemd; tusd ships as a container, so it's a `docker run` unit,
  not compose). Prod CORS origins (`https://(s-nc\.org|s-nc\.tv)`), hook-auth warning in the
  header.
- **`deploy/Caddyfile.prod.example`** — both site blocks repointed `/uploads/* → TUSD_IP:8070`,
  with `request_body max_size 20GB` lifted on that path so tus chunk PATCHes aren't clipped by the
  10MB site cap. `caddy validate` clean (placeholders substituted).
- **`.work/releases/0.4.0/release-0.4.0.md`** — added a `Resumable (tus) uploads on prod` check to
  the existing `## Prod verification` section, gated on this item landing, with the hook-auth
  confirmation folded in.

## Folded in: deferred 0.3.0 security S1

Exposing tusd in prod is exactly when the deferred S1 "tusd hooks network auth" matters — the
`/api/tusd/hooks` endpoint has no app-level network auth. Both the service template and the work
item flag that the hook must be locked to tusd's source (loopback bind / firewall / shared
secret) before tusd is reachable in prod. The release verification check confirms it.

## Learnings

- **Dev/prod parity gap with no failure signal until prod traffic.** The whole tus path was
  exercised in dev (4GB HEVC round-trip) and looked done, but dev and prod route `/uploads/`
  through entirely different topologies (tusd container vs. API), and prod's never existed. A
  release ships when the *dev* round-trip passes; the prod-only leg (tusd deployment + Caddy
  routing) had no gate. The `## Prod verification` section exists for exactly this class — the fix
  is to *populate* it at ship time for any path whose prod topology differs from dev, not just for
  the obvious OAuth/SMTP/real-follower cases. A green dev round-trip on a path that routes
  differently in prod is not evidence the prod path works.

- **"Deployed" for a containerized sidecar ≠ "in docker-compose."** tusd being in
  `docker-compose.yml` reads as "it's part of the stack," but prod doesn't run compose — it runs
  systemd app units. Any service that's compose-only is dev-only by default. Worth checking, for
  every compose service, whether it has a prod deployment path at all (Garage, SRS, imgproxy,
  Liquidsoap, Mailpit each need their own — Mailpit explicitly shouldn't ship).

- **Couldn't reach prod from the submodule.** The actual `Deploy Production` Forgejo workflow
  lives in the parent repo's CI, outside platform — and the prod host itself is unreachable here.
  Evidence (six independent sources: client config, dev Caddy, prod Caddy example, API routes,
  systemd units, the 0.3.0 deploy session note) is conclusive that tusd isn't on prod, but the box
  is the one place I can't confirm. Flagged in the item: confirm host state before applying.

## State at end of session

- Work tabled for the next release per user — **not** an emergency hotfix. Artifacts are drafted
  so the deploy is mechanical once scheduled: fill the `TUSD_IP` / Garage-endpoint / hook-URL
  placeholders with real prod addresses and walk the 0.4.0 verification check.
- Backlog item `release_binding: null` (unscoped); the 0.4.0 verification check is the regression
  guard. Bind it to 0.4.0 at review-pass when the deploy work is scoped.
