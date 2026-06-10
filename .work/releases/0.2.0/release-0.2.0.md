---
id: release-0.2.0
kind: release
stage: released
tags: []
parent: null
depends_on: []
release_binding: 0.2.0
gate_origin: null
quality_gates_passed: [refactor, security, tests, docs]
related_items: []
created: 2026-04-18
updated: 2026-06-10
---

# Release 0.2.0 — Streaming Goes Live

Retroactive bundle summary. The `release-0.2` board produced the platform's streaming-capable state. Work landed March 2026; production shipped on SRS + Liquidsoap + FFmpeg + pg-boss. Per-phase implementation detail lives in git history; this file is the epoch-level context.

## Load-bearing decisions promoted from this epoch

- Position: srs-streaming-server — SRS operational mechanics (`.research/analysis/positions/srs-streaming-server.md`)
- Position: pg-boss-job-queue — job queue choice (`.research/analysis/positions/pg-boss-job-queue.md`)
- Position: vidstack-media-player — client-side player (`.research/analysis/positions/vidstack-media-player.md`)
- Position: tv-model-playout-architecture — TV model + SRS vs MediaMTX comparative reasoning (`.research/analysis/positions/tv-model-playout-architecture.md`)
- Position: liquidsoap-playout-engine — always-on channel playout engine (`.research/analysis/positions/liquidsoap-playout-engine.md`)

## What's not preserved

~46 design briefs under `boards/platform/release-0.2/design/` — all shipped-and-code-carries-the-design work. Deleted 2026-04-18 during boards-migration. Full index (for git archaeology):

- **Streaming + playout**: `phase-2-live-page.{brief,}.md`, `phase-3-srs-swap.{brief,}.md`, `phase-4-callbacks-sessions.{brief,}.md`, `phase-5-playout-pipeline.{brief,}.md`, `phase-5-playout-spike.{brief,}.md` (brief promoted to platform-0009), `phase-5a-channels.{brief,}.md`, `phase-6-chat-mvp.{brief,}.md`, `on-demand-playlist-reload.md`, `playout-admin-fixes.md`, `playout-admin-queue-playlist.{brief,}.md`, `presigned-url-playout.md`, `snc-tv-broadcast-channel.md`, `srs-callback-auth.md`, `tv-model-architecture.md` (promoted to platform-0008), `vod-recording-spike.md`, `broadcast-channel-fixes.md`
- **Content + media**: `content-management-redesign.{brief,}.md`, `content-route-separation.{brief,}.md`, `global-player.md`, `global-player-fixes.md`, `media-streaming.brief.md`, `media-streaming-vidstack.{brief,}.md`, `mkv-ingest-simplification.{brief,}.md`, `upload-integration.md`, `vidstack-player-fixes.md`
- **Live page + simulcast**: `live-page-viewer-layout.{brief,}.md`, `creator-simulcast-destinations.{brief,}.md`, `simulcast-destination-management.{brief,}.md`
- **Infrastructure**: `pipeline-foundation.{brief,}.md`, `schema-at-boundary-params.md`

## Quality gate posture

All four gates ran on shipping code: refactor scan (9 scopes, 7 libraries, 309 files), security scan (11 rules, 27 findings, 22 fixed with 2 S3 carried forward as backlog), e2e golden-path tests (52 tests across 15 specs), documentation (streaming architecture, playout operations, pg-boss job queues, production deploy guide, Pino logging).
