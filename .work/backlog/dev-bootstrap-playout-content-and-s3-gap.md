---
id: dev-bootstrap-playout-content-and-s3-gap
kind: backlog
tags: [streaming, playout, dev-env]
created: 2026-06-14
---

# Dev bootstrap can't get S/NC TV airing: no playout-content seed + API S3 client errors

Surfaced 2026-06-14 while bootstrapping a fresh dev env for streaming fix-verify. A new
dev DB cannot reach a playing S/NC TV without manual yak-shaving; several gaps compound.

## Symptoms (in encounter order)
- After `db:seed-channels`, `/live` shows "Nothing playing right now"; channels exist but
  the broadcast airs nothing.
- "No creator rows so I can't log in" — `db:seed-channels` seeds only channels;
  `seed:admin` only *promotes* an existing user. You must run `seed:demo` first (creates
  loginable users incl. `admin@snc.demo` / `password123` + creator profiles). The seed
  order/login dependency isn't documented anywhere obvious.
- `seed:demo` completes but throws "tons of S3 errors" (`code: S3_ERROR, error:
  UnknownError`) on its demo-video upload step.
- Admin adds content to the pool, but Now Playing stays empty — content never becomes
  playable.

## Root causes (diagnosed)
1. **No playout-content DB seed.** The broadcast (`snc_tv`) airs from a Liquidsoap
   `request.queue` (`snc-tv-queue`) the API orchestrator fills from **DB** content. The
   dev seed scripts (`seed-playout-content.sh`) only upload clips to **Garage S3**; they
   never register DB playout content, so the orchestrator has nothing to enqueue.
   `generate-playout-playlist.sh` writes `liquidsoap/playlist.m3u`, but the generated
   `playout.liq` broadcast fallback (`[live_source, snc_tv_queue, blank, blank]`) does
   **not** read that file — it's vestigial for the broadcast. Net: S/NC TV can only air a
   *live* RTMP source (`scripts/dev/test-live-fallback.sh`) or DB-queued content that
   nothing seeds.
2. **API S3 client throws `UnknownError` while raw `@aws-sdk` uploads to Garage succeed.**
   `seed-playout-content.sh`'s direct upload to `s3://snc-storage/playout/` works
   (host, repo-root `.env`, `forcePathStyle:true`), but the API's storage client
   (`apps/api/src/storage/provider.ts`, `new S3Client({ endpoint: cfg.S3_ENDPOINT, region:
   cfg.S3_REGION })`) errors on operations. Likely an endpoint/env mismatch between what
   the pm2-on-host API resolves for `S3_ENDPOINT` and the host-reachable Garage
   (`localhost:3900` vs the docker-internal `snc-garage:3900`), or the API loading a
   different `.env` than the seed scripts. `pm2 ecosystem.config.cjs` only sets
   `NODE_ENV`; it does not override `S3_ENDPOINT`. This is the keystone: if the API can't
   reach S3, uploaded pool content can't be ingested/processed → never playable → Now
   Playing empty + S/NC TV blank. **Diagnose:** compare the API's resolved `S3_ENDPOINT`
   (`pm2 env <api-id>`) against repo-root `.env` and confirm host reachability.
3. **`playout.liq` goes stale.** It's generated from DB topology at a point in time; after
   `db:seed-channels` on a fresh DB the "Playout Channels (generated from database)"
   section can be empty until the API regenerates + restarts Liquidsoap
   (`regenerateAndRestart`). No dev step triggers this after seeding.

## Already fixed this session (dev-script bugs, committed)
- `seed-playout-content.sh` ran its node upload from repo root → `ERR_MODULE_NOT_FOUND`
  on `dotenv`/`@aws-sdk`; now runs from `apps/api` (commit `f6d9180`).
- `generate-playout-playlist.sh` listed via the absent `aws` CLI → silent wedge under
  `set -euo pipefail`; now lists via node `@aws-sdk` `ListObjectsV2` (commit `7d86600`).
- dotenv banner leaked into the playlist `KEYS` capture; silenced with `quiet:true`
  (commit `a359f9d`).

## Fix directions to weigh at scope time
- A real `dev:seed-playout` that registers DB playout content (the `channel_content`
  playout rows the orchestrator reads) AND triggers `regenerateAndRestart` so S/NC TV
  self-airs in dev — replacing the S3-only `seed-playout-content.sh` + vestigial
  `generate-playout-playlist.sh`.
- Fix / document the API `S3_ENDPOINT` for the pm2-on-host context (the keystone — also
  blocks demo video seed + any content ingest in dev).
- Document the seed order + login path: `db:migrate` → `seed:demo` (login +
  creators) → `db:seed-channels` → (playout-content seed, once it exists). Surface it in
  `platform/AGENTS.md` or `scripts/dev/`.
- Relates to `bold-channel-topology-drift-detection` (a silent playout-down state it
  should surface loudly) and `srs-callback-rate-limit-deadlock` (a different playout-wedge
  class).
