# Session: image-size DoS fix + CI e2e skip-guard + Caddy dev-env dockerization

**Date:** 2026-08-12 (continuation of the 2026-08-11 SSR/undici session)
**Outcome:** dev green on `:3080` (Caddy); `platform-test-and-build` CI green.

## image-size dropped (security DoS) — `drop-image-size-magicbyte-header-dims`
- `image-size <=2.0.2` carries unfixed **high DoS advisories** (ICNS/JXL/HEIF
  parser infinite loops) reachable from the content-library ingest path; no
  upstream fix exists.
- Replaced with an owned magic-byte + header detector (`apps/api/src/lib/image-detect.ts`):
  non-jpg/png/webp magic rejected before any parse; jpg SOF scan bounds-checked
  + capped at `MAX_FILE_SIZES`. `press-pdf` reads stored blob dims (legacy
  fallback via the detector). `image-size` dep + its skill removed.
- **Design pivot:** originally scoped imgproxy `/info` for dimensions; a live
  probe found `/info` is **Pro-only** (OSS imgproxy 3.31 → 404), so the operator
  greenlit **in-house header parsing** — strictly better (no new runtime dep,
  no ingest chicken-and-egg, dims come from the same in-memory bytes as format).
- Cross-model reviewed (gpt-5.6-sol, approve-with-nits); DoS guarantee confirmed
  adversarially; 3 nits fixed (webp RIFF-size bound + regression test; legacy
  download stream cancel; press-pdf failure-mode coverage). Public surface
  unchanged. Verified: api unit 2020, integration 54, web 1910, audit 4→2.

## nanoid resolved
- Root `resolutions` nanoid `^5.1.16` (was 5.1.7). **bun resolutions are
  range-aware** — postcss keeps its declared `^3.3.17` → 3.x; the blanket only
  moved the 5.x consumers. The "postcss landmine" warning (SNC's, which I
  echoed) was wrong; verified empirically.

## CI e2e — 12 playout/streaming specs skip in CI
- CI `test-e2e` runs only **postgres + api + web** (no Liquidsoap/SRS); the
  playout specs are real-stack HLS/Liquidsoap probes that fundamentally require
  it. **Not a regression** — channels ARE seeded; the media runtime isn't.
  (Unmasked once the SSR fix let the e2e suite run past the old 500s.)
- Guarded with an `E2E_PLAYOUT` flag (`apps/e2e/tests/helpers/playout-stack.ts`):
  `E2E_PLAYOUT=skip` (set in the parent `test-e2e` step env) → 12 skip; locally
  (unset) → run + pass. Whole-file skip for the 2 playback specs; per-test for
  4 live-streaming + 1 admin-playout + 1 navigation-to-live.
- A-vs-C (provision/mock the playout stack in CI) parked at root
  `.work/backlog/idea-e2e-playout-stack-ci-coverage`.

## Caddy dev-env — dockerized + host-matcher fix (the deep one)
- Symptom: dev site **blank on `:3080`** (web route 0 bytes; `/api` worked).
- **Root cause:** `Caddyfile.dev` matched sites by host `localhost` →
  non-localhost hosts (`127.0.0.1`, the LAN IP) routed into Caddy's
  default-site fallback, which **drops the vite dev server's chunked response
  bodies** (`Content-Length` `/api` survived). **Not the Caddy version** — a
  red herring; I proved the current 2.11.4 was identical until the host matcher
  was removed.
- Fix: **dockerized Caddy** (`docker-compose.yml` `caddy` service — official
  `caddy:2-alpine`, host networking; replaces the stale Debian apt 2.6.2 binary)
  + **removed the `localhost` host matchers** (`:3080`/`:3082`/`:3084` serve any
  host). `start-dev.sh` no longer starts a host caddy; `devcontainer.json`
  drops `caddy` from apt. Committed **`2e3e3a7` — local, not yet pushed**.
- Lesson: the bisection was confounded twice (the `@hls` named-matcher detour,
  and leftover `:3097` test cruft corrupting the Caddyfile). Clean single-variable
  tests + restoring the file between probes would've saved time.

## Asset serving
- Demo seed run (content + creators + avatars + media all in Garage).
- imgproxy (official container) reads Garage + serves resized images.
- `IMGPROXY_URL` must be the **LAN IP** (`http://192.168.50.110:8081`) so the
  browser reaches it. It was missing from `.env`, and a stale pm2 process-env
  value (`localhost:8081`, from an earlier `--update-env`) **shadowed** the
  `.env` value (dotenv doesn't override existing `process.env`). Fixed via a
  clean api restart (`pm2 delete api && pm2 start ecosystem.config.cjs --only api`).

## Cross-verification with SNC (mesh)
- SNC caught two of my errors: a SHA transcription typo (`ff6b06cc` vs `ff6b06c4`)
  and the `E2E_PLAYOUT` flag **placement** (workflow step env, not the webServer
  API env — the guard reads `process.env` in the Playwright *test worker*). SNC
  also corrected the nanoid landmine theory.
- I caught: image-size exploitability (authenticated-upload DoS path), and the
  Caddy **host-matcher** root cause (after chasing the version red herring).
- Good mutual discipline — verify-don't-trust held both directions.

## Carry-forwards
- **Caddy fix (`2e3e3a7`) is local/unpushed** — push + SNC submodule bump when
  ready. (The SSR/undici, image-size, nanoid, and e2e-guard work is already on
  origin + parent pointer-bumped.)
- **`IMGPROXY_URL` → `.env.example`** (was missing — add a default so fresh
  setups don't hit this). And don't inject it via `pm2 --update-env` (shadows
  `.env`); keep it in `.env`.
- **A-vs-C** playout-stack CI coverage — root backlog.
- **TanStack start-server-core moderate** (fix at `1.167.30`) — platform backlog
  `audit-drain-tanstack-start-server-core`. **@babel/core low** — no clean fix.
- **media-picker test flake** (order-dependent; passes in isolation) — still loose.
- **web-staging drift** — not auto-restarted on code changes (went stale pre-undici
  this session); local-dev hygiene note surfaced to operator.
