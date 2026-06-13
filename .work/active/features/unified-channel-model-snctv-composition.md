---
id: unified-channel-model-snctv-composition
kind: feature
stage: drafting
tags: [streaming, playout]
parent: unified-channel-model
depends_on: [unified-channel-model-editorial-engine]
release_binding: null
gate_origin: null
created: 2026-06-13
updated: 2026-06-13
---

# S/NC TV as composition — takeover becomes programming

## Brief
Re-express S/NC TV's hardcoded editorial priority as channel-as-source programming on the
editorial engine: today's `fallback([live_source, snc_tv_queue, defaultPlayoutSource,
blank()])` becomes an ordinary editorial config — live creator carry (channel-as-source),
own queue, pool fallback — making the creator takeover a visible, editable programming
decision instead of plumbing. This is the epic's "line 192 becomes the rule" moment and
the engine's first real consumer.

The review bar is **output-equivalence**: same airing behavior as today's fallback
semantics for the same inputs (live creator preempts, queue next, default playout pool,
silence last; takeover and fall-back transitions behave identically from the viewer's
seat). Where the engine's mechanism makes exact `.liq`-level byte-identity impossible
(this is a behavior-bearing epic, not a refactor), equivalence is demonstrated
behaviorally — the design pass defines the equivalence checks (likely: rendered-config
review + the live-fallback test script `scripts/dev/test-live-fallback.sh` + staged
manual verification per platform's fix-verify discipline).

Does NOT cover: changes to simulcast semantics (simulcast stays on the S/NC TV output —
whatever S/NC TV airs is what forwards); creator-side editorial (sibling
`creator-enablement`); new viewer UI (takeover visibility indicators are
`live-experience-redesign-live-state`'s).

## Epic context
- Parent epic: `unified-channel-model`
- Position in epic: first composition consumer of `editorial-engine`; the validation gate
  that the unified model actually expresses what the special case did.

## Foundation references
- `docs/streaming.md` — S/NC TV fallback chain, simulcast-on-playout-output
- Epic body `## Decisions` — carry model (channel-as-source), rejected alternatives
