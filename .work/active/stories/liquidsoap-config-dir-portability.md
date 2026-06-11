---
id: liquidsoap-config-dir-portability
kind: story
stage: done
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
- [x] Fresh clone at an arbitrary mount path: API writes `playout.liq` into the repo's `liquidsoap/` dir (default derives from module location; covered by path-equality test anchored at the test file)
- [x] No `/workspaces/` literal remains in `apps/api/src/services/liquidsoap-config.ts` (pinned by a source-text regression test)

## Implementation notes
- Direction chosen: **repo-relative code default** via `import.meta.url` (the API runs under tsx, so module location is stable) — `DEFAULT_LIQUIDSOAP_DIR` resolves `../../../../liquidsoap` from `src/services/`. `LIQUIDSOAP_CONFIG_DIR` stays as the documented override; `.env.example` comment now states the default. Env wiring via `ensure-env.sh` was rejected: it would make a correct boot depend on a scaffolding step, and the value would itself need a mount-path assumption.
- `getLiquidsoapConfigPath` is now exported (JSDoc per the always-tier convention) for the regression test.
- Tests added: `getLiquidsoapConfigPath` describe block — default-path equality (anchored at the test file's own location, depth-symmetric with the module) and `LIQUIDSOAP_CONFIG_DIR` override. Plus a source-text regression test asserting no `/workspaces/` literal in the module — behavior alone can't catch a reintroduced hardcode in a checkout that happens to live at the old path (first attempt at a runtime literal-check failed for exactly that reason in this workspace).
- Verification: 15/15 in the file, full `@snc/api` unit suite 1501/1501 green, API restarted under pm2 with health 200 and `playout.liq` present.
- Discrepancies from design: none. Adjacent issues parked: none.

## Review record
- 2026-06-11 — Verdict: Approve — story verified by implement (full unit suite green, live API health check); fast-lane advance.
