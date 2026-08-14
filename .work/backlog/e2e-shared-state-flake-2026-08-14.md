---
id: e2e-shared-state-flake-2026-08-14
kind: story
stage: backlog
tags: [testing, streaming, workflow]
parent: null
depends_on: []
release_binding: null
gate_origin: found during brand-voice-system completion verification 2026-08-14
created: 2026-08-14
---

# E2E shared-state flake (programming/playback/content-manage/auth-setup)

## Evidence (2026-08-14, brand-voice-system drain)

Three full `@snc/e2e` runs against the dev stack produced three different failure sets at
varying commits — including identical-looking failures at the pre-run commit `b51aef2`:

| run | commit | result |
|---|---|---|
| 1 | post-run HEAD | 6 failed (content-manage, browser-playback, channel-playback, creator-programming ×3), 122 passed |
| 2 | pre-run b51aef2 (scoped) | global auth-setup failed; programming pool tests failed |
| 3 | pre-run b51aef2 (full) | 2 failed (browser-playback, auth-flow mobile), 125 passed — programming passed |

Failure sets vary run-to-run at the SAME commit → shared-state/environment flake, not code
regression. Brand-voice diff (styles/tokens/routes/press-PDF) does not touch the
streaming/playout domain. Notably `e2e-harness-determinism` (done) did not eliminate this
class.

## Likely contributors

- dev API under pm2 with 2D uptime accumulating state across unit/integration/e2e runs
  (test-control resets may not cover everything);
- staging web + dev API state divergence; browser-playback (Vidstack decode/advance) is the
  most frequent repeat offender and may warrant its own timeout/stability pass.

## Work

Reproduce after a full dev-stack restart (`bash scripts/dev/start-dev.sh` or
`pm2 restart all`); if stable, harden the harness (reset coverage for the flaking specs);
if still flaky, isolate browser-playback (the constant offender) for its own stability
pass. Consider whether creator-programming pool specs need per-run isolation.
