---
id: gate-docs-streaming-md-legacy-harbor
kind: story
stage: review
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

## Implementation (2026-06-29)
- Files changed: `docs/streaming.md`
- Tests added: none (foundation-doc rewrite only)
- Verification: checked the rewritten claims against `apps/api/src/services/playout-topology.ts`, `apps/api/src/services/liquidsoap-client.ts`, `apps/api/src/services/liquidsoap-config.ts`, `apps/api/src/services/liquidsoap-render.ts`, `apps/api/src/services/editorial-control.ts`, `apps/api/src/routes/playout-channels.routes.ts`, and `apps/api/src/services/playout-orchestrator.ts`.
- Discrepancies from design: `arm` is generated as a per-channel path, but the renderer only emits the live `/arm` Harbor handler for non-broadcast playout channels; the doc states that constraint.
- Adjacent issues parked: none.
