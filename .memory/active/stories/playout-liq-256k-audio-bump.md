---
id: story-playout-liq-256k-audio-bump
kind: story
stage: done
tags: [streaming, media-pipeline]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-21
related_decisions: []
related_designs: []
parent: null
---

# Bump playout.liq audio encoder to 256k AAC

Bump the Liquidsoap audio encoder in `platform/liquidsoap/playout.liq` from 128k to 256k AAC. Regenerate playout config. Restart Liquidsoap.

Affects S/NC TV viewers — Liquidsoap re-encodes audio for the broadcast channel. Higher bitrate improves perceived audio quality on the playout path.

## Scope

Single config change. No app code. No schema. Ops work to apply in prod also required but that's a user-station follow-up tracked separately.

## Acceptance

- [x] `platform/liquidsoap/playout.liq` AAC encoder bitrate bumped from 128k to 256k
- [x] Playout config regenerated — template in `apps/api/src/services/liquidsoap-config.ts` also updated to 256k so the next `regenerateAndRestart` call produces a matching file
- [x] Liquidsoap restart verified locally (dev docker compose) — `snc-liquidsoap` container restarted healthy, health check responding on :8888

## Context

Follow-on to streaming quality considerations for the Animal Future live show (2026-04-24). The Belabox GStreamer upstream bump to 256k AAC is a parallel user-station task on the capture side.
