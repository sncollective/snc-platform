---
id: research-srs-vendored-source
tags: [research, streaming]
release_binding: null
research_origin: vendored-source-research-mode
created: 2026-06-16
updated: 2026-06-18
---

# [research] Vendored-source acquire + orient: SRS v6 — delivery surface (WHIP/WHEP, DVR, HLS)

Apply vendored-source research mode to SRS's **protocol-delivery surface**, source-orienting the
`srs-v6` skill. **Engagement entry:** `/agentic-research:research-orchestrator`.

**Scope narrowed 2026-06-18.** The `stack-library-gap-audit` engagement (2026-06-18) already cloned
SRS (v6.0.48) and source-confirmed the **callback/forward control surface** —
`on_publish`/`on_unpublish` semantics, the `on_forward` vs `http_hooks` lifecycle, the
`max_connections` ceiling (no separate max-streams/vhosts cap), and the `vcodec` passthrough. Those
were the Liquidsoap audit's open questions; they are now **closed** (attestation
`.research/attestation/srs-src-v6.md`, brief `.research/analysis/briefs/stack-library-gap-audit-landscape.md`),
and the on_forward skill claim was corrected. What remains uncovered is the delivery surface below.

## Acquire
- A clone already exists from the gap audit (SRS **v6.0.48** in the gitignored holding-spot). Note
  the running container reports **v6.0.184** (no such git tag); resolve and re-clone the exact
  delivery-surface code if WHIP/WHEP/DVR/HLS internals turn out version-sensitive. `:6` remains a
  major-only pin — pinning it is tracked by `pin-docker-compose-image-versions`.

## Orient (the uncovered delivery surface)
- **WHIP / WHEP** — the WebRTC ingest/egress endpoints and their config; source-confirm the doc
  claims that map to `streaming-low-latency-webrtc`.
- **DVR (`dvr_plan`)** — recording modes, segment/session semantics; maps to `streaming-dvr-rewind-live`
  and `streaming-srs-dvr-recording`.
- **HLS window semantics** — `hls_window` / `hls_fragment` behavior, the live-edge/segment retention
  model; relevant to DVR-rewind and low-latency delivery.

## Grounding
- Existing position: `.research/analysis/positions/srs-streaming-server.md` (selection rationale).
- Control-surface already discharged: `.research/attestation/srs-src-v6.md` (this engagement
  extends it to the delivery surface, does not repeat it).
- Method: the **vendored-source research mode** (clone-at-pinned-version; source = `source-direct`
  tier, docs = portal tier). Carried in `research_origin: vendored-source-research-mode`.

## Applicability check (the gate)
Source-available ✓ (OSS, github). Behavior/version-internals load-bearing ✓ — the WHIP/WHEP/DVR/HLS
internals gate three live backlog items; docs-tier claims there are unverified. Passes — and is now
the *only* uncovered SRS source-tier surface after the gap audit.
