---
id: e2e-browsers-on-demand
kind: story
stage: done
tags: [developer-experience, testing]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-11
updated: 2026-06-11
parent: null
---

# Cold-boot hardening from the first standalone-devcontainer rebuild

## Brief

Field finding from the first cold-boot rebuild of the standalone devcontainer: the
Playwright chromium download (~170 MB from the CDN) wedged at the tail of the transfer —
progress bar at 100%, downloader process idle at 0% CPU, cache at 18 MB — stalling
`postCreateCommand` indefinitely and blocking every step chained after it (pre-commit
install, postStart). The download is the heaviest and demonstrably flakiest cold-boot
step, and nothing in the dev stack needs it: only `bun run --filter @snc/e2e test` does.

Change: browsers install **on demand** via `scripts/dev/install-e2e-browsers.sh`
(repo-relative like its siblings; idempotent — Playwright skips cached browsers; runs the
download with `NODE_OPTIONS=--dns-result-order=ipv4first`, the same dual-stack-stall
mitigation the VS Code server applies to its own node). The devcontainer postCreate drops
the playwright step. Docs updated: AGENTS.md e2e command line, CLAUDE.md scripts list,
README devcontainer paragraph.

Rejected alternative: keeping the install in postCreate behind `|| true` + ipv4first —
non-blocking, but a silent failure there means e2e breaks later with no signal pointing
at the missing browsers; an explicit on-demand script fails loudly at the moment the
operator actually wants browsers.

**Second field finding (same rebuild walk):** opened from a submodule checkout (the
enclosing repo holds this project as a submodule), the workspace's `.git` is a gitlink
pointing outside the mount — git is unusable in the container and `pre_commit install`
failed postCreate with exit 1, skipping postStart. postCreate now guards that step
(`git rev-parse --git-dir` probe; skip with an explanatory message when git is degraded),
and the README states the standalone-clone expectation. The degraded mode is deliberate:
dev stack fully works; commits happen from the enclosing checkout.

**Third finding — the actual root cause of the wedge:** not network, not the container.
Reproduced the stall deterministically in the enclosing dev environment (download completes
to a temp zip; extraction freezes at ~18 MB — everything before the large `chrome` binary —
with one process blocked forever on an IPC pipe read). It is the upstream regression
microsoft/playwright#40998 / #41092: playwright 1.55.1-1.59.1 deadlocks during archive
extraction on Node 24.16+; the lockfile had resolved `@playwright/test ^1.52.0` to
playwright-core 1.59.1. Fix: bump the pin to `^1.60.0` (fixed upstream). The speculative
ipv4first mitigation was removed from the install script (wrong hypothesis — the download
was never the problem); the script comment now names the >=1.60 constraint instead.

## Acceptance
- [x] `scripts/dev/install-e2e-browsers.sh` passes `bash -n`, runs from an arbitrary CWD, idempotent on a warm cache
- [x] Full cold install completes: cache wiped, script run from `/tmp`, exit 0, 641 MB of browsers extracted (chromium + headless shell + ffmpeg)
- [x] E2e suite runs under playwright 1.60: 96/113 pass; the ~17 failures are pre-existing app/data drift since 2026-04-24 (suite was un-runnable meanwhile), parked as backlog `e2e-suite-drift-triage` per test-integrity — not bump regressions
- [x] Devcontainer postCreate no longer contains a playwright step; JSON valid
- [x] Docs name the on-demand step where e2e is documented
- [x] postCreate succeeds in a submodule-checkout container (pre-commit step skips with a message instead of failing the lifecycle); unchanged behavior in a real git repo

## Implementation notes
- Files: `scripts/dev/install-e2e-browsers.sh` (new), `.devcontainer/devcontainer.json`,
  `AGENTS.md`, `CLAUDE.md`, `README.md`, `apps/e2e/package.json` + `bun.lock` (playwright
  `^1.52.0` → `^1.60.0`).
- The enclosing-container devcontainer carries the same postCreate simplification (its
  e2e runs use the same on-demand script) — landed alongside as an inline rider in that
  repo, same change-shape.
- Verification: `bash -n` clean; both devcontainer JSONs valid; live run of the script
  from `/tmp` on a warm cache completes (recorded below at review).

## Review record
- 2026-06-11 — Verdict: Approve — story verified by implement (cold install exit 0 with 641 MB extracted, both guard branches exercised, e2e suite runnable with drift parked per test-integrity); fast-lane advance.
