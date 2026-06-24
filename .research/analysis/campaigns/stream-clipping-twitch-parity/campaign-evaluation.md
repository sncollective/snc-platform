---
title: "Campaign evaluation — stream-clipping-twitch-parity"
campaign: stream-clipping-twitch-parity
gate: evaluate
updated: 2026-06-24
---

# Campaign evaluation (isolated-context gate)

The `evaluate` gate ran isolated — only the synthesis (`parent.md`) + the engagement seed.

## Per-component assessment

- **Coverage — 5/5.** Q1–Q4 all addressed traceably (mechanics, viewer-UGC surface, stack-reuse
  table, MVP-vs-full + parity gap); the architecture-open caveat carried; Kick/Twitch-UI gaps
  flagged openly, not silently dropped.
- **Coherence — 5/5.** Clear spine (DVR prerequisite → YouTube-near / Twitch-far → cheap extraction
  → viewer clips are product-surface); headline maps onto §1–§4; no non-sequiturs.
- **Contradictions — 5/5.** Three substantive entries (timing models; full-copy vs pointer;
  pre-moderation vs §512), named-source side-by-side, surfaced-not-smoothed; separate
  `## Disconfirming analysis`.
- **Groundedness — 4/5.** Strong citation posture + honest UNCONFIRMED / not-legal-advice markers.
  Four claims forwarded as spot-check candidates (composed/named-claim watch).

**Verdict: APPROVED.**

## Lead spot-check disposition (the 4 forwarded candidates — all CLEAN)

1. **12-frame GOP default** [ffmpeg-codecs-gop] — attestation confirms `-g` default 12, and the
   libx264-keyint caveat the synthesis honored. ✓
2. **PeerTube-on-Garage** [garage-overview] — attestation names PeerTube ("integrate natively via
   S3 API — PeerTube's presence confirms video platform use cases"). ✓
3. **~85s Twitch rolling buffer** [twitch-clips-api-docs] — verbatim-attested ("about 85 seconds
   before the call and about 5 seconds after"). ✓
4. **§512-favorability inference** — the financial-benefit *test* is attested
   [dmca-section-512]; the "favorable fact pattern" is the synthesis's hedged inference
   ("*not legal advice*"). Acceptable as marked inference. ✓

The single `adversarial-read` finding (parent §4 Twitch creator-delete over-read) was fixed before
this gate. No further corrections needed.
