---
id: research-srs-vendored-source
tags: [research, streaming]
release_binding: null
research_origin: vendored-source-research-mode
created: 2026-06-16
---

# [research] Vendored-source acquire + orient: SRS v6

Apply vendored-source research mode to SRS — clone at our pinned version, source-orient the
`srs-v6` tech-reference skill with source-grounded internals. **Engagement entry:**
`/agentic-research:research-orchestrator`.

## Acquire
- **Pin:** we run `ossrs/srs:6` (docker-compose) — a **major-only tag, version-imprecise**.
  Resolve the actual patch version the `:6` tag pulls and clone github.com/ossrs/srs at that exact
  tag. (The imprecise pin is itself worth flagging — it's the "docs/pins don't version-pin
  elegantly" case the vendored-source position names.)

## Orient (source-grounded internals worth pinning, not full campaign)
- The open questions the Liquidsoap audit carried and could not close from docs:
  **max streams / vhosts** for dynamic channels (docs gave only `max_connections`); the precise
  `on_forward` vs `http_hooks` lifecycle; the transcode `vcodec` value set (we found software-only,
  worth byte-confirming from source).
- WHIP/WHEP, DVR (`dvr_plan`), HLS window semantics — source-confirm the doc claims that map to our
  backlog (low-latency-webrtc, dvr-rewind, srs-dvr-recording).

## Grounding
- Existing position: `.research/analysis/positions/srs-streaming-server.md` (selection rationale).
- The Liquidsoap audit's `srs-ffmpeg-seam` facet already did a docs-tier pass + flagged
  byte-exact re-fetch as an acquisition candidate; this item is the source-tier follow-up.
- Method: the **vendored-source research mode** (clone-at-pinned-version; source = `source-direct`
  tier, docs = portal tier; the two-pronged applicability gate). Carried in the
  `research_origin: vendored-source-research-mode` frontmatter; the orchestrator reads it at kickoff.

## Applicability check (the gate)
Source-available ✓ (OSS, github). Behavior/version-internals load-bearing ✓ (open Qs from the
audit; streaming roadmap depends on SRS internals). Passes the gate — not a docs-suffice case.
