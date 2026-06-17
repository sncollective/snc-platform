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
5. **Pool scope is `channelId`-bounded, not ownership-scoped** (Important). `resolvePoolNextUri`
   (control-service) draws from the channel's curated `channel_content` rows (LRP), and `void`s the
   `poolContentScope` resolver. The design's ownership-scoped auto-draw (creator → own content; admin →
   *all* creators') is NOT realized — admin channels don't auto-draw the whole library. Deferred with the
   admin-content/hidden-creator work (the all-creators scope falls out once admin content lives under a
   hidden creator). If the curated-per-channel pool proves insufficient before then, wire `poolContentScope`
   into the `resolvePoolNextUri` query (creator → content WHERE creatorId; admin → all-creator content).

6. **Manual-pin index alignment vs the I2 live-tier exclusion** (Important — same class as B2, introduced
   by the B1-downgrade I2 fix). The live-tier exclusion is done in the **render** (`renderTierSource`
   returns null for `live`; `renderedTiers`/`tierVarNames` exclude it), but `manualTierIndex` is computed in
   **topology** over `enabledTiers` which still **includes** live tiers. So a channel with an enabled `live`
   tier *before* a manual-pinned tier gets divergent index spaces → the pin resolves to the wrong slot /
   `mksafe(blank())` (silence). Latent today (live tiers deferred + no editorial config exists), but it'll
   bite once a creator channel has `live` + a manual pin. **Fix:** exclude `live` tiers in **topology**
   (drop them from `ch.tiers` and compute `manualTierIndex` over that same live-excluded set) so the render
   has a single tier set — then the render-side skip + the index agree. Add a topology test: enabled `live`
   before a manual-pinned `queue` → the pin resolves to the right (live-excluded) index.

Done: the `pool/next` endpoint shipped in control-service (the render's `request.dynamic` calls it;
secret-guarded, plain-text URI, LRP rotation via `lastPlayedAt`/`playCount`). The B1-downgrade landed
(commit `d89be5a`): mode/manual via regenerate-restart, dead refs/endpoints removed, `--check` exit 0.
