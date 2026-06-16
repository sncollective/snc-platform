---
id: research-imgproxy-vendored-source
tags: [research, content, media-pipeline]
release_binding: null
research_origin: vendored-source-research-mode
created: 2026-06-16
---

# [research] Vendored-source acquire + orient: imgproxy v3

Apply vendored-source research mode to imgproxy (image processing proxy) — clone at our pinned
version, source-orient the `imgproxy-v3` tech-reference skill. **Engagement entry:**
`/agentic-research:research-orchestrator`.

## Acquire
- **Pin:** `ghcr.io/imgproxy/imgproxy:v3` (docker-compose) — **major-only tag, version-imprecise.**
  Resolve the patch version the `:v3` tag pulls and clone github.com/imgproxy/imgproxy at that exact
  tag. (Imprecise-pin flag, same shape as SRS.) Go.

## Orient (source-grounded internals worth pinning)
- **URL signing** — our config sets `IMGPROXY_KEY`/`IMGPROXY_SALT`; source-confirm the exact
  signature scheme + what's signed (the security boundary).
- **Format negotiation** — we enforce WebP/AVIF (`IMGPROXY_ENFORCE_WEBP/AVIF`) with per-format
  quality; confirm the negotiation/fallback behavior from source.
- **S3 source behavior** — it reads from Garage (`IMGPROXY_USE_S3` + path-style); cross-references
  the Garage item for the S3 surface it depends on.
- **Resource limits** — `IMGPROXY_MAX_SRC_RESOLUTION`, TTL/caching semantics.

## Grounding
- No existing position (imgproxy selection is implicit). Skill: `imgproxy-v3`.
- Method: the **vendored-source research mode** (clone-at-pinned-version; source = `source-direct`
  tier, docs = portal tier; the two-pronged applicability gate). Carried in the
  `research_origin: vendored-source-research-mode` frontmatter; the orchestrator reads it at kickoff.

## Applicability check (the gate)
Source-available ✓ (OSS, Go). Behavior/version-internals load-bearing ✓ (signing is a security
boundary; format negotiation + S3 source behavior are behavior questions). Passes — lower urgency
than SRS/Garage/tusd (imgproxy is well-documented; trigger if a specific behavior question bites).
