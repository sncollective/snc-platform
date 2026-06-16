---
id: research-handoff-liquidsoap-version-capability-audit-1
kind: story
stage: drafting
tags: [streaming, playout, deploy]
parent: null
depends_on: []
release_binding: null
gate_origin: null
research_origin: liquidsoap-version-capability-audit
created: 2026-06-16
updated: 2026-06-16
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
