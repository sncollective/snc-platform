---
id: research-handoff-liquidsoap-version-capability-audit-1
kind: story
stage: done
tags: [streaming, playout, deploy]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: null
research_origin: liquidsoap-version-capability-audit
created: 2026-06-16
updated: 2026-06-17
---

# Upgrade Liquidsoap 2.4.2 → 2.4.5

Bump the playout engine base image from `savonet/liquidsoap:v2.4.2` to `v2.4.5`. The go decision
is made (operator-decided 2026-06-16); this story executes it. Low-stakes, revertible: it's a
one-line Dockerfile pin and our `.liq` is regenerated, not hand-migrated.

## Why now

The 2.4.3–2.4.5 fixes are *latent* on our current simple render graph but activate exactly when
the editorial-engine rearchitecture reaches for richer primitives (crossfade, runtime clock
detach, runtime harbor-handler removal, `source.dynamic`). Upgrading first means the editorial
implementation builds on the hardened engine: clock-detach-while-running (#5051), sub-clock CPU
growth on long pipelines (#5032/#5103), and skip-from-harbor crashing crossfade (#5194) are all
fixed by 2.4.5. The upgrade also delivers `request.queue.remove` (selective queue-item removal for
arm/take). 2.4.5 is a point release on the same 2.4 line — no API break on our paths (verified in
source: `switch`/`source.dynamic`/`fallback` semantics unchanged 2.4.2→2.4.5).

## Acceptance / steps

1. **Pre-upgrade greps** (mechanical, should be no-ops on our render):
   - Grep rendered/static `.liq` for `source(video=canvas)` — a breaking annotation rename to
     `video=yuv420p` lands in **2.5.0**, not 2.4.5, so this is a forward-discharge, not a blocker.
   - Grep for `liq_cross_start_duration` / `liq_cross_end_duration` / `start_duration` /
     `end_duration` crossfade usage — none expected (we have no crossfade code).
2. **Bump the pin** — `platform/liquidsoap/Dockerfile` `FROM savonet/liquidsoap:v2.4.2` →
   `v2.4.5`; rebuild the playout image.
3. **Staging verify end-to-end** before prod — the editorial spike's harbor-control paths
   (skip/queue), the fallback chain, now-playing, and a live creator takeover/fallback cycle.
4. **Revert plan** — if any regression surfaces on the live stream, revert the one-line Dockerfile
   pin and rebuild. (Mitigation for thin automated regression coverage: ship-and-watch.)

## Research grounding

**Source**: `.research/analysis/campaigns/liquidsoap-version-capability-audit/parent.md`
(slug: `liquidsoap-version-capability-audit`)

The audit's headline recommendation: upgrade 2.4.2 → 2.4.5 now, ahead of the editorial-engine
implementation, leaning on revertibility given thin regression coverage. The upgrade-relevant deltas
and the pre-upgrade checklist derive from the source-verified version-delta facet.

## Implementation notes

Design was already complete in the body (research-handoff-embedded acceptance/steps), so the
drafting→implementing transition was a trivial confirmation, not a fresh design pass.

- **Files changed:** `platform/liquidsoap/Dockerfile` — line 1 `FROM savonet/liquidsoap:v2.4.2` →
  `v2.4.5` (the sole change; our `.liq` is regenerated, not hand-migrated).
- **Step-1 pre-upgrade greps (executed, both clean no-ops as predicted):**
  - `source(video=canvas)` — **0 hits**. The breaking `video=canvas`→`video=yuv420p` annotation
    rename lands in 2.5.0, not 2.4.5, so it is a forward-discharge, not a blocker for this bump.
  - `liq_cross_start_duration` / `liq_cross_end_duration` / `start_duration` / `end_duration`
    crossfade annotations — **0 hits** (we have no crossfade code).
- **Tests added:** none — there is no automated regression harness for the playout image (the
  audit's "thin regression coverage" finding); verification is the operator's staging walk below.
- **Discrepancies from design:** none.
- **Adjacent issues parked:** none.

### Operator verification (at-station)

The code change is landed. Per platform's fix-verify loopback, the story stays at `stage: review`
until the operator confirms the stream renders end-to-end; the rebuild + structural verify are done.

1. **Rebuild the playout image** off the bumped Dockerfile. — **DONE (2026-06-17, staging).**
   `docker compose build --no-cache snc-liquidsoap` → recreate. `docker exec snc-liquidsoap
   liquidsoap --version` reports **2.4.5** (was 2.4.2). Container `(healthy)`; `.liq` typechecked +
   evaluated clean; all per-channel harbor endpoints registered (incl. the editorial
   `now-playing`/`skip` routes); clocks started with all channel sources; no error/fatal log lines;
   S3 content fetch + playout resumed; the `awscli`/`curl` apt layer rebuilt correctly. The editorial
   staging walk (sibling gate) then runs against this 2.4.5 pipeline.
2. **Staging verify end-to-end** — **DONE (2026-06-17, operator visual confirm).** The stream renders
   in a player off the 2.4.5 pipeline (operator confirmed video plays on S/NC Music / S/NC TV). SRS is
   serving HLS for every channel off the 2.4.5 engine (`channel-*.ts` segments writing continuously);
   harbor-control paths exercised via the sibling editorial staging walk on the same pipeline (skip/queue,
   now-playing, arm/take live, the regenerate-restart cycle — all green). Staging verify complete.
3. **Ship-and-watch** to prod (mitigation for thin automated regression coverage). — **operator-at-station,
   outstanding.** This story closes on the staging verify; the prod rebuild+ship is the deploy action,
   tracked alongside `pin-docker-compose-image-versions`.
4. **Revert plan** if any regression surfaces on the live stream: revert the one-line Dockerfile
   pin back to `v2.4.2` and rebuild.

Note: the only other in-repo `v2.4.2` references are in
`.research/attestation/liquidsoap-src-version-delta.md` — a point-in-time research attestation
recording the source-diff evidence (production = v2.4.2 at audit time); deliberately left unchanged.

## Close (2026-06-17) — staging-verified → done, bound to 0.4.0

**Verdict: Approve — staging verify complete.** The image was rebuilt from the v2.4.5-pinned Dockerfile,
the container recreated, and `liquidsoap --version` confirms **2.4.5** (was 2.4.2). The pipeline came up
healthy (`.liq` typechecked + evaluated, all harbor endpoints registered, clocks started, S3 fetch +
playout resumed, 0 error/fatal lines). The operator confirmed the stream renders in a player off the 2.4.5
pipeline, and the sibling editorial staging walk exercised the harbor-control / regenerate-restart paths
on the same engine (all green). The `awscli`/`curl` apt layer rebuilt correctly.

**Advanced `review → done`, bound to release `0.4.0`** (the engine the editorial-engine bundle builds on).
**Outstanding (deploy action, not this story's gate):** the prod rebuild + ship-and-watch is operator-at-
station, tracked alongside `pin-docker-compose-image-versions`. Revert plan if a prod regression surfaces:
re-pin `v2.4.2` + rebuild.
