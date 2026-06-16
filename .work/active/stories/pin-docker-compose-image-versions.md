---
id: pin-docker-compose-image-versions
kind: story
stage: drafting
tags: [deploy, content, streaming]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-16
updated: 2026-06-16
---

# Pin docker-compose image versions (resolve unpinned + major-only tags)

Surfaced while grounding the vendored-source research items: several service images are pinned
imprecisely or not at all, which is a reproducibility / drift risk on load-bearing paths. This
story resolves them. **The operator executes the compose edits** — `docker-compose.yml` is a
repo-denied file (agents can't edit it), and re-pinning changes which digest the next deploy
pulls, so it's a hand-on-keyboard deploy action, not an autonomous edit.

## The findings (resolved targets)

| Service | Current | Resolved-to (this machine, 2026-06-16) | Action |
|---|---|---|---|
| **tusd** | `tusproject/tusd:latest` ⚠️ **unpinned** | `v2.9.2` | **Pin — urgent.** `:latest` on the upload path drifts on any pull. |
| **imgproxy** | `ghcr.io/imgproxy/imgproxy:v3` (major-only) | `v3.31` | Pin to `v3.31` (confirm current at edit time). |
| **SRS** | `ossrs/srs:6` (major-only) | **needs confirming** — image labels only carry the base OS (`20.04`), not the SRS release; the running image was built 2025-12-03. Resolve via `docker exec snc-srs ./objs/srs -v` (operator, on the live container) or the OSSRS release for that build. | Pin to the exact `6.x`. |
| **Garage** | `dxflrs/garage:v2.2.0` | — | Already precise ✓. No change. |
| **postgres** | `postgres:16` | — | **Leave.** Major-pin is conventional + safe for Postgres (data compatibility holds within a major; minor bumps are intended). Noted, not changed. |
| **mailpit** | `axllent/mailpit:latest` | — | **Leave (dev-only).** Not a prod/load-bearing service; drift is low-stakes. Noted, not changed. |

## Steps (operator)

1. Resolve the SRS exact version (`docker exec snc-srs ./objs/srs -v`, or OSSRS release notes for
   the 2025-12-03 `:6` build).
2. Edit `docker-compose.yml`: `tusd → v2.9.2`, `imgproxy → v3.31`, `srs → <exact 6.x>`. Leave
   postgres and mailpit as-is (rationale above).
3. `docker compose -f docker-compose.yml -f docker-compose.claude.yml up -d` to re-pull at the
   pinned tags; confirm each service comes up healthy (`docker compose ps`).
4. Verify the upload path (tusd), an image transform (imgproxy), and the live stream (SRS) still
   work after the re-pin.

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
