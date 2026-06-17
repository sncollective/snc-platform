---
id: editorial-render-followups
kind: backlog
tags: [streaming, playout, tests]
created: 2026-06-17
---

# Editorial render/topology follow-ups (from the unified-model bundle review)

Non-blocking findings from the review of `unified-channel-model-editorial-engine-topology` +
`-render` (unified-model revision, Approve, 2026-06-17). The render was validated against real
Liquidsoap (`liquidsoap --check`, exit 0) — these are coverage/hygiene, not correctness.

1. **Multi-tier auto render path is untested** (Important). All render goldens are queue-only-default
   channels (no editorial config exists in the test DB), so the readiness-fallback + armed-gate ordering
   for a *configured* multi-tier channel (e.g. live@0 + queue@1 + channel-as-source@2) has no golden or
   unit test. Add a render test that seeds a multi-tier editorial config and asserts the switch shape
   (config-order readiness fallback, queue gated by `armed()`, manual-pin path).

2. **Wire `liquidsoap --check` into the render test suite** (Important). The golden test asserts the
   rendered string, not that it's *valid* Liquidsoap — a wrong primitive (e.g. the `request.dynamic`
   shape) would pass the golden but break pipeline load. A `--check` step (throwaway container off the
   playout image, as the spike did) would catch this automatically. This review ran it by hand and it
   passed; automate it.

3. **`null()` → `null`** (nit). The pool `request.dynamic` block uses the deprecated `null()` form
   (`liquidsoap --check` Warning 5). Non-breaking on 2.4.x but errors in a future major (2.5.0). Quick
   fix in `liquidsoap-render.ts` (regenerate goldens after).

4. **`PoolScope` SSOT dup** (nit). `PoolScope` is defined in both `editorial-config.ts` and
   `playout-topology.ts` (the latter to keep the topology module DB-free). Move the type to `@snc/shared`
   (no DB) and import in both, rather than duplicating.

Code: `apps/api/src/services/liquidsoap-render.ts`, `apps/api/src/services/playout-topology.ts`.
Reminder: the `pool/next` endpoint the render's `request.dynamic` calls is the control-service story's
job; until it ships the pool is not-ready and the fallback skips silently (correct startup behavior).
