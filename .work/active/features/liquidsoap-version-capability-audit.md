---
id: liquidsoap-version-capability-audit
kind: feature
stage: done
tags: [research, streaming, playout]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: null
research_origin: unified-channel-model-editorial-engine
research_refs: [liquidsoap-version-capability-audit]
created: 2026-06-16
updated: 2026-06-16
research_dials:
  scope_authority: mixed
  verification_rigor: full
  intent: inform-decision
  output_kind: [synthesis-brief, upgrade-recommendation]
---

# Liquidsoap version-delta + streaming-stack capability-gap audit

## Brief

We are mid-rearchitecture of playout (the `unified-channel-model` epic; the `editorial-engine`
feature). The editorial-engine spike + source-dive (2026-06-16) established that live no-restart
switching works on our production Liquidsoap **2.4.2**, but surfaced two things that warrant a
deliberate research pass before the rearchitecture commits:

1. **Upstream has moved.** Latest is **2.4.5** (2026-06-15); **2.5.0** is unreleased. Several
   changelog entries between 2.4.2 and 2.4.5 fix bugs **on paths this rearchitecture will use**,
   and 2.5.0 adds capabilities that map to our backlog.
2. **We have no Liquidsoap reference corpus.** Our knowledge is the `liquidsoap-v2` skill (now
   extended with a Dynamic Topology section) plus ad-hoc spikes. A grounded audit against the
   source tree — which we now have cloned and tag-pinned — produces durable substrate the whole
   streaming roadmap reuses.

This is a `[research]` engagement: an **input that grounds the rearchitecture decisions**, not a
shippable deliverable. It does not bind to a release; verification gates run inline in the
orchestrator. It routes to `agentic-research:research-orchestrator`.

## Engagement questions

### Q1 — Version delta 2.4.2 → 2.4.5 (and what 2.5.0 brings)

Which changelog entries touch **our** paths? Already-identified load-bearing items to verify
against source and expand:

- **2.4.5 `request.queue.remove` / `remove_request_id`** (+ telnet `remove`) — pull a *specific*
  queued request without skip/flush. Directly relevant to **arm/take** editorial control.
- **2.4.5 fix: `source.skip` from a harbor handler / `thread.run` crashing `cross`/`crossfade`** —
  our render calls `${vid}_source.skip()` *inside harbor handlers*. If we add crossfades, 2.4.2
  crashes on this path. Load-bearing.
- **2.4.5 fix: `harbor.remove_http_handler` discarding all other handlers** — matters if the design
  does runtime per-channel harbor-endpoint CRUD.
- **2.4.3 fix: "clock source detach when clock is running"** — the exact runtime-detach path the
  CRUD-without-restart finding depends on was buggy in 2.4.2. Verify the 2.4.2 behavior and the
  2.4.3 fix.
- **2.4.3 fix: sub-clock accumulation causing gradual CPU growth** — long-running-pipeline
  stability (ours run for days).
- **2.4.1/2.4.2 fixes: `source.dynamic` source leaks + premature cleanup** — `source.dynamic` is
  the primitive the content-swap finding rests on; confirm how mature it is on 2.4.2 vs 2.4.5.
- **2.5.0: subtitles/captions as a content type** (native SRT, `%subtitle`, `on_subtitle`,
  `subtitles.insert`) — maps to backlog `streaming-auto-captions` + `streaming-subtitle-delivery-player`.
- **2.5.0: Icecast-compatible server, unified `cross` `duration` param, `source.content`/
  `track.format` introspection** — assess relevance.

### Q2 — Upgrade recommendation (2.4.2 → 2.4.5?)

A clear recommendation with **adversarial refutation**: what breaks or behavior-diffs on the
production streaming path if we upgrade? Regression-risk read. Cover the changed `cross`/crossfade
semantics, any `track_sensitive`/`fallback` behavior changes, encoder/ffmpeg-binding changes, and
whether the container image rebuild is clean. Output a go/no-go with conditions.

### Q3 — Streaming-stack-wide gap audit

Range into the adjacent stack where gap-finding connects:
- **SRS** — our version + capabilities, the Liquidsoap↔SRS seam (RTMP push, `on_forward`,
  simulcast), anything that constrains or enables the rearchitecture.
- **ffmpeg encoder surface** — what our `%ffmpeg` encoder block does/doesn't use; ABR / multi-rendition
  implications.
- **Map findings to our backlog** — at minimum: `streaming-snctv-fallback-dynamic-channel`,
  `streaming-snctv-broadcast-source-selector`, `streaming-programming-epg`,
  `streaming-liquidsoap-single-queue-per-output`, `streaming-low-latency-webrtc`,
  `streaming-dvr-rewind-live`, `streaming-abr-transcoding-strategy`,
  `streaming-multi-rendition-playout-transcoding`. For each, note whether a newer Liquidsoap/SRS
  capability changes its feasibility or shape.

## Substrate already in hand

- **Cloned, tag-pinned Liquidsoap source** at `.memory/scratchpad/liquidsoap-src` (2.4.2 checked
  out; `origin/main` fetched for 2.5.0). The orchestrator should read source directly — deep rigor.
- **Full `CHANGES.md`** (all versions through 2.5.0) at `/tmp/liq-spike/CHANGES-main.md`.
- **Spike findings** in `.research/analysis/positions/editorial-engine-switching-mechanism.md` —
  the no-restart switching mechanism, the CRUD boundary, control-plane surface, all with file:line
  evidence. This audit extends, not repeats, that work.
- **Production engine config** — `docs/streaming.md`, `apps/api/src/services/liquidsoap-render.ts`,
  `playout-topology.ts` (the render seam), and the `liquidsoap-v2` skill (just extended).

## Dials (set with user at scoping, 2026-06-16)

- **scope_authority: mixed** — the three engagement questions above are **fixed, must-answer
  deliverables** (full rigor); on top of them, the **gap-audit portion (Q3) may discover and pursue
  new angles** as the source tree / backlog surface them, surfacing each as it goes. Chosen over
  pre-registered because the gap audit is inherently discovery-shaped — the value is partly in the
  gaps we did NOT already enumerate. Pairs with the streaming-stack-wide scope (SRS/ffmpeg ranging
  is pre-authorized).
- **verification_rigor: full** — every capability claim verified against the cloned source; the
  upgrade recommendation gets a full adversarial refutation + a 2.4.2→2.4.5 behavior-diff audit +
  regression risk on the production path.
- **intent: inform-decision** — grounds the rearchitecture (upgrade call + capability map for the
  editorial-engine design and the streaming backlog). Not a shippable deliverable.
- **output_kind: synthesis-brief + upgrade-recommendation** — a `.research/analysis/` brief (likely
  `-landscape`) mapping versions×capabilities×our-backlog, plus a crisp upgrade recommendation.

## Decomposition (Checkpoint A, confirmed 2026-06-16)

Candidate C (hybrid 4-facet) chosen over A (by-engagement-question — facet coupling: upgrade
depends on version-delta) and B (by-source-domain — loses the our-paths focus, smears backlog
mapping). Four parallel specialist facets; the upgrade recommendation is lead synthesis (inherently
cross-facet):

1. **`ls-version-delta`** — 2.4.2→2.4.5 changelog × source verification, OUR-paths focus (the
   load-bearing facet: skip-from-harbor/crossfade, clock-detach-while-running, source.dynamic
   maturity, queue.remove).
2. **`ls-2.5.0-capabilities`** — forward-looking: 2.5.0 features (subtitles/captions, Icecast,
   cross unification, source.content/track.format) + the editorial/CRUD primitives' maturity arc.
3. **`srs-ffmpeg-seam`** — the stack-wide discovery surface (mixed scope authorizes it): SRS 6
   capabilities, the LS↔SRS RTMP/on_forward/simulcast seam, ffmpeg encoder surface.
4. **`backlog-feasibility-map`** — consumes the others' capability findings, maps them onto the
   named streaming backlog items (feasibility-changed? shape-changed?).

## Output destination

`.research/analysis/` (brief/landscape + recommendation). On completion, the operator-confirmed
`research-handoff` may emit follow-up `.work/` items (e.g. an upgrade story, or feasibility-changed
backlog items) carrying `research_origin: liquidsoap-version-capability-audit`.

## Engagement record (closed 2026-06-16)

Ran end-to-end through `agentic-research:research-orchestrator`. Dials honored as scoped
(scope_authority: mixed · verification_rigor: full · intent: inform-decision · output_kind:
synthesis-brief + upgrade-recommendation).

- **Decomposition:** Candidate C (hybrid 4-facet), confirmed at Checkpoint A.
- **Fan-out:** 4 parallel research-specialists — `ls-version-delta`, `ls-2.5.0-capabilities`,
  `srs-ffmpeg-seam`, `backlog-feasibility-map`.
- **Verification (full rigor, all passed):** lint (exit 0, 0 blocking; caught + fixed one
  citation-target error) → adversarial-read (APPROVED + 1 required fix R1 applied; independently
  re-verified load-bearing claims in source) → evaluate (isolated context, APPROVED) → spot-check
  (clean).
- **Output:** `.research/analysis/campaigns/liquidsoap-version-capability-audit/` — `parent.md`
  (synthesis + upgrade recommendation), 4 specialist briefs, `acquisitions.md`,
  `verification-checklist.md`, `campaign-evaluation.md`. 13 source-direct attestations in
  `.research/attestation/`.

### Headline outcomes (for the rearchitecture)

1. **Upgrade recommendation: ship Liquidsoap 2.4.2 → 2.4.5 now** (operator-decided), lean on
   revertibility (one-line Dockerfile pin) given thin regression coverage. The 2.4.3–2.4.5 fixes are
   *latent* on our current simple graph but activate exactly when the editorial design reaches for
   crossfade / runtime detach / runtime handler-removal / `source.dynamic`.
2. **2.5.0 adds no new switching/CRUD power** — don't wait for it. Its subtitles content-type is a
   carriage seam (no ASR), and the captions/subtitles backlog items are player-side (the seed
   hypothesis was corrected by the discovery surface).
3. **Backlog partitions cleanly** into LS-side (editorial cluster, reshaped by the spike), SRS-side,
   player-side, ffmpeg-sidecar — an LS bump moves only the editorial cluster.
4. **VAAPI/ABR: encode outside SRS** (SRS transcode is software-libx264 only).
5. **Qualifies the spike position:** runtime detach is "possible but not race-safe" on 2.4.2 (#5051
   fixed 2.4.3) — the upgrade discharges this.

### Follow-on (operator-gated)
- An upgrade story (2.4.2 → 2.4.5 Dockerfile bump + staging verify + the pre-upgrade greps) is the
  natural emission — run `/agentic-research:research-handoff liquidsoap-version-capability-audit`.
- Open questions carried (not closed): `h264_vaapi` in Liquidsoap's `%ffmpeg` encoder; SRS
  max-streams/vhosts for dynamic channels.
