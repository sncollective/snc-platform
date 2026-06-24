---
title: "Acquisition manifest — stream-clipping-twitch-parity"
campaign: stream-clipping-twitch-parity
updated: 2026-06-24
---

# Acquisition manifest

Consolidated from the three specialists. Verification-independent offgas — gaps regardless of the
synthesis verdict. Promotion into `.work/` (the standing `research-acquisition-queue`) is
operator-confirmed, never automatic.

## Blocking (a load-bearing source could not be fetched)

| Source | Class | Web-availability | Completes |
|---|---|---|---|
| **Kick clips docs** (help.kick.com / docs.kick.com) | primary-doc | All kick.com requests 403; docs.kick.com has no clips section; no Wayback snapshots | The entire **Kick** column of the parity table |
| **Twitch help-center clip articles** (help.twitch.tv) | primary-doc | JS-rendered; WebFetch returns CSS errors / empty | Twitch **UI-level** clip behavior — Clips-tab presence, viewer report flow, whether a broadcaster can delete viewer clips, the exact disable path |
| **Twitter/X player-card spec** (developer.x.com player card) | primary-doc | 402 (gated) | The `twitter:player` inline-video card requirements (the later "inline play in posts" feature) |

## Enriching (would deepen a facet beyond the web layer)

| Source | Class | Web-availability | Completes |
|---|---|---|---|
| **SRS `on_hls` callback payload spec** (ossrs.net v6 http-callback) | primary-doc | Public, not fully fetched | Whether the HLS callback carries the segment file path (live-segment clip triggers) |
| **SRS DVR RAW-API endpoint** (SRS issues #319/#459) | primary-doc | Public | Whether DVR can be toggled per-stream at runtime vs. always-on |
| **libx264 default keyint** (ffmpeg-codecs §libx264) | primary-doc | Anubis-blocked on fetch | The keyframe interval for platform-transcoded VOD → stream-copy boundary-imprecision estimate |
| **PeerTube clip/chapter docs** (joinpeertube.org/docs) | primary-doc | Public | A co-op-adjacent (FOSS, self-hosted, Garage-compatible) architectural comparator for viewer UGC |
| **YouTube Made-For-Kids clip eligibility** (YouTube Help, specific article) | primary-doc | Public, article id unknown | YouTube's clip eligibility exceptions (COPPA/Kids) — a parity-table edge |
