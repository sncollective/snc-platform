---
id: seed-demo-hardening
created: 2026-08-06
tags: [workflow, developer-experience, security]
---

# seed-demo.ts hardening (post auto-seed wiring)

Two platform-side refinements deferred from the demo auto-seed work. The CI
wiring + scoping landed in the **parent SNC repo** (SNC agent, commits
`12bf3a3d` scope + `b007a51d` implement, root scope) — no platform change was
needed for the core deliverable. These close the loop on verification + safety.

## 1. `--check` smoke
Add a `--check` mode to `apps/api/src/scripts/seed-demo.ts` that asserts the
expected post-seed state — admin role granted to `admin@snc.demo` +
`maya@snc.demo`, demo creators present — and exits non-zero otherwise. Lets the
demo-deploy CI **positively confirm "the seed took"** rather than relying on
exit code alone (an upsert can exit 0 without the role actually landing in an
edge case). Wire via `seed:demo --check` after the seed step in
`.forgejo/workflows/platform-deploy-demo.yml` (parent repo — coordinate with the
SNC agent).

## 2. Guard-hardening (latent footgun)
`seed-demo.ts`'s production guard (`NODE_ENV=production && ALLOW_DEMO_SEED!=true
→ exit 1`) is currently **bypassed** because the `seed:demo` package script
hardcodes `ALLOW_DEMO_SEED=true`. Safe today only because prod CI never invokes
it. Stronger construction: remove the hardcode from the package script; set
`ALLOW_DEMO_SEED=true` only at the (demo-only) call site. **Platform-only change (no root-side work):** the SNC agent's demo-heredoc
call site *already* sets `ALLOW_DEMO_SEED=true` explicitly (commit `b007a51d`), so
removing the hardcode from the `seed:demo` package script lands the target
construction directly — the flag stays at the demo-only call site. (Confirmed by
the SNC agent 2026-08-06; recorded in its `story-demo-auto-seed` too.)

Neither blocks the demo auto-seed (functional with the exit-code gate). Fold in
post-EPK. Originated from the SNC agent's review of `story-demo-auto-seed`
(parent root `.work/`).
