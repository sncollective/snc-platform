---
id: pin-discipline-lint
kind: backlog
tags: [workflow, deploy]
created: 2026-06-16
---

# Pin-discipline lint — block unpinned / imprecise image + dependency versions

Parked idea (prevention, not yet shaped). We shipped `tusproject/tusd:latest` (unpinned) and
major-only tags (`srs:6`, `imgproxy:v3`) — a lint should have stopped the unpinned one at commit
time. Pre-commit already exists (gitleaks, check-doc-links, baseline) with no pin check; this slots
alongside as a local hook.

## Sketch (decide the shape when picked up)
- A `scripts/check-image-pins.py` (mirroring `check-doc-links.py`) that scans staged
  `docker-compose*.yml` + `Dockerfile`s for `:latest` and unpinned/major-only tags; block the commit.
- **Needs an allowlist** — `:latest` is acceptable for dev-only services (e.g. `mailpit`). The
  allowlist design is the main open question (a comment marker? a config file? a service-name list?).
- Open: how strict on major-only tags (`postgres:16` is *conventionally* fine — major-pin is safe
  for Postgres; `srs:6` is not). Block `:latest` hard; warn (not block) on major-only, or allowlist
  per-service.
- Could extend to npm (flag `*`/`latest` ranges) but the image case is the live pain.

## Why parked, not built
Not a mechanical add — the allowlist + major-only policy needs design, and the 2 current unpinned
cases are already being fixed by the `pin-docker-compose-image-versions` deploy story. Build the
hook when the policy is settled (or if unpinned images recur). Pairs with the
`dependency-currency-strategy` item (this is the *prevention* half; that is the *currency* half).
