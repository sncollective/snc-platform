---
id: gate-docs-streaming-md-legacy-harbor
kind: story
stage: implementing
tags: [documentation]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: docs
created: 2026-06-29
updated: 2026-06-29
---

# `docs/streaming.md` still documents the legacy M3U/reload and fixed Harbor endpoint model

## Severity
Critical (foundation-doc drift — rolling foundation is a hard rule)

## Drift type
foundation-doc

## Location
`docs/streaming.md:119,126,132,138,146`; contradicting: `apps/api/src/services/playout-topology.ts:175`, `apps/api/src/services/liquidsoap-client.ts:52`, `apps/api/src/services/liquidsoap-config.ts:135`

## Evidence
The doc lists fixed Harbor endpoints like `/now-playing`, `/queue`, `/classics/*`, `/reload-playlist`, and says Liquidsoap reads a regenerated `playlist.m3u`. The code now generates per-channel Harbor paths (`/channels/${channelId}/queue|skip|now-playing|arm`) and applies config changes via `regenerateAndRestart()` writing `playout.liq` and signaling `/admin/shutdown`, not `/reload-playlist`.

## Remediation direction
Rewrite the Harbor API and playlist-regeneration sections around the generated per-channel editorial engine: per-channel queue/skip/now-playing/arm, pool auto-fill, generated `playout.liq`, and restart-on-structural-config changes.
