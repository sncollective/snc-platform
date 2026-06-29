---
id: pin-docker-compose-image-versions
kind: story
stage: review
tags: [deploy, content, streaming]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: null
created: 2026-06-16
updated: 2026-06-29
---

# Pin docker-compose image versions (resolve unpinned + major-only tags)

Surfaced while grounding the vendored-source research items: several service images are pinned
imprecisely or not at all, which is a reproducibility / drift risk on load-bearing paths. This
story resolves them. **The operator executes the compose edits** — `docker-compose.yml` is a
repo-denied file (agents can't edit it), and re-pinning changes which digest the next deploy
pulls, so it's a hand-on-keyboard deploy action, not an autonomous edit.

## The findings (resolved targets)

| Service | Was | Resolved + pinned (this machine, 2026-06-29) | Action / status |
|---|---|---|---|
| **tusd** | `tusproject/tusd:latest` ⚠️ unpinned | `v2.9.2` | ✅ **Already pinned 2026-06-18** (commit `c7dad98`). Running image confirms v2.9.2. No further action. |
| **imgproxy** | `ghcr.io/imgproxy/imgproxy:v3` (major-only) | `v3.31` | ✅ **Pinned 2026-06-29.** Resolved from running image's OCI label (`v3.31-amd64`). Recreated + healthy. |
| **SRS** | `ossrs/srs:6` (major-only) | `6.0.184` | ✅ **Pinned 2026-06-29.** Resolved via `docker exec snc-srs ./objs/srs -v` → `6.0.184`. Recreated + healthy. |
| **Garage** | `dxflrs/garage:v2.2.0` | `v2.2.0` | ✅ Already precise. No change. |
| **postgres** | `postgres:16` | `16` | ✅ **Leave.** Major-pin conventional + safe for Postgres. Noted, not changed. |
| **mailpit** | `axllent/mailpit:latest` | `latest` | ✅ **Leave (dev-only).** Not load-bearing; drift is low-stakes. Noted, not changed. |

## Steps (operator) — DONE 2026-06-29

1. ~~Resolve the SRS exact version.~~ → `6.0.184` via `srs -v`.
2. ~~Edit `docker-compose.yml`.~~ → imgproxy `:v3 → :v3.31`, srs `:6 → :6.0.184` (tusd already pinned
   2026-06-18). Postgres + mailpit left as-is (rationale above).
3. `docker compose up -d snc-imgproxy snc-srs snc-liquidsoap` → all three recreated + pulled at
   pinned tags, all `(healthy)`.
4. Verify the live stream (SRS) after the re-pin → **see recovery note below**; both channels
   (`channel-classics`, `snc-tv`) producing HLS segments, playout end-to-end green.

## Coordinates with the Liquidsoap 2.4.5 rebuild (closed this session)

`research-handoff-liquidsoap-version-capability-audit-1` was marked done 2026-06-17 with notes
that the operator rebuilt the image to 2.4.5 and verified — but that rebuild+verify happened on a
**different machine**. On *this* dev machine the running image was still 2.4.2 (image built
2026-06-13, three days before the Dockerfile bump to 2.4.5 on 2026-06-16). This session closed
that drift:

- `docker compose build --no-cache snc-liquidsoap` → rebuilt off the v2.4.5-pinned Dockerfile.
- `docker exec snc-liquidsoap liquidsoap --version` → **2.4.5** (was 2.4.2). Drift closed.
- Recreated the container; `.liq` typechecked + evaluated, harbor endpoints registered, clocks
  started — clean 2.4.5 startup.

## Recovery: the recreate surfaced a pre-existing disk-full + reconnect-storm (not introduced by pinning)

Recreating the containers surfaced two pre-existing conditions that had nothing to do with the
image pinning, but had to be cleared to restore the playout path so dev matches the 0.4.0 prod
surface:

1. **Postgres was down — disk full.** `snc-postgres` had `PANIC: could not write ... No space
   on device` (root filesystem at 95%, 2.2G free). Postgres exiting broke every API DB query,
   which surfaced as the `INTERNAL_ERROR` JSON Liquidsoap received on its `/pool/next` content
   callbacks. Fixed by pruning docker build cache + dangling images (reclaimed ~1.3GB → 92% /
   3.5G free) and restarting postgres. The 2026-06-29 `machine-verifiable-testing` session note
   records the same "Postgres exited once (stale checkpoint)" pattern — this disk-pressure
   condition is recurring and should be addressed at the environment level (larger volume /
   scheduled prune) separately from this story.
2. **SRS `StreamBusy` reconnect storm.** After the container recreates, Liquidsoap's 2-second
   `output.url` retry loop reconnected to SRS faster than SRS released the previous publish slot
   → `StreamBusy` / `acquire_publish() errno=11`. A single `docker restart snc-srs` cleared the
   stale publish state and the stream latched on cleanly. This is the same transient the
   2026-06-29 session note documents ("SRS needed a restart once to clear stale StreamBusy
   publish state — a pre-existing Liquidsoap↔SRS reconnect-storm artifact, not introduced here").

After both were cleared, the API→Liquidsoap content path returned 200 (`/pool/next`, userAgent
`Liquidsoap/2.4.5`), the 2.4.5 engine decoded seed content (`aac/h264 640x360`), and both channels
are producing HLS: `channel-classics.m3u8` + `snc-tv.m3u8`, 5 segments each, advancing (`snc-tv-75.ts`
at last check). Dev now matches the 0.4.0 prod surface: Liquidsoap 2.4.5, tusd v2.9.2, imgproxy
v3.31, SRS 6.0.184.

## Notes

- **Coordinates with `research-handoff-liquidsoap-version-capability-audit-1`** (the Liquidsoap
  2.4.2 → 2.4.5 upgrade): that story edits `liquidsoap/Dockerfile` (a `FROM` pin), this one edits
  the compose image tags. Same hygiene theme, different files — can ship together or separately.
- **Digest-pinning (`@sha256:…`) was considered and not chosen** for v1: stronger immutability but
  digests must be hand-bumped on every intended upgrade, which fights the readable-tag workflow.
  Revisit if drift recurs despite tag-pinning, or if a supply-chain requirement lands.
- The imprecise SRS/imgproxy tags are *also* noted in their vendored-source research items
  (`research-srs-vendored-source`, `research-imgproxy-vendored-source`) as the "docs/pins don't
  version-pin elegantly" case — this story is the operational fix; those are the source-research.
