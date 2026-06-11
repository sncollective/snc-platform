---
id: liquidsoap-config-dir-portability
kind: story
stage: implementing
tags: [playout, developer-experience]
release_binding: null
depends_on: []
gate_origin: null
created: 2026-06-11
updated: 2026-06-11
parent: null
---

# liquidsoap-config.ts defaults to a hardcoded absolute workspace path

## Brief

Review finding from the standalone-devcontainer feature (deep review, 2026-06-11).
`apps/api/src/services/liquidsoap-config.ts:26` falls back to
`config.LIQUIDSOAP_CONFIG_DIR ?? "/workspaces/SNC/platform/liquidsoap"`, and
`LIQUIDSOAP_CONFIG_DIR` is commented out in `.env.example`. In a clone mounted anywhere
else, the API writes the real `playout.liq` to a dead absolute path — liquidsoap never
receives the generated config and playout silently stays on the bootstrap stub. The
bootstrap scripts are mount-path-agnostic; this app-code default is the remaining
absolute-path assumption on the playout path.

Fix direction (pick at implementation): make the code default repo-relative (resolve
from the module's location or `process.cwd()` contract), or have `ensure-env.sh` +
`.env.example` set `LIQUIDSOAP_CONFIG_DIR` explicitly. Add a regression test asserting
the default contains no absolute workspace path.

## Acceptance
- [ ] Fresh clone at an arbitrary mount path: API writes `playout.liq` into the repo's `liquidsoap/` dir
- [ ] No `/workspaces/` literal remains in `apps/api/src/services/liquidsoap-config.ts`
