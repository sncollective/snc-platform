# Multi-Platform Device Strategy

Research doc mapping the device landscape for S/NC streaming and content delivery. Goal: understand what it takes to reach feature parity with Twitch/YouTube across devices, and surface decisions that affect current architecture.

## Current State

S/NC delivers live streams and VOD content via the **web app** only:
- **Live**: SRS → HLS (H.264 + AAC, 2s fragments) → Vidstack player
- **VOD**: Garage S3 → H.264 + AAC MP4 → Vidstack player
- **ABR**: Not yet implemented; single quality stream. Planned as FFmpeg sidecar with VAAPI hardware encoding (see streaming board, Competitive Parity)

The web app works on any device with a modern browser, but native apps are required for push notifications, background playback, PiP, casting, and living room device UIs (10-foot interface).

## Device Landscape

### Tier 1: Web (shipped)

Already works. H.264 + AAC in HLS is universally supported. ABR renditions (when implemented) will improve mobile web experience on cellular.

### Tier 2: Mobile (iOS + Android)

The highest-impact expansion. Mobile is where most live stream consumption happens (Twitch: ~65% mobile, YouTube: ~70% mobile).

**What native apps unlock:**
- Push notifications (go-live alerts — ties into notifications board)
- Background audio playback (critical for music streams)
- Picture-in-picture
- Chromecast / AirPlay casting
- Offline VOD downloads (subscriber perk)
- Deep links from notifications

**Build options:**

| Approach | Pros | Cons |
|----------|------|------|
| **React Native** | Shared JS/TS codebase with web, large ecosystem, Expo for managed workflow | Performance ceiling for video-heavy apps, native module bridging for advanced media |
| **Flutter** | High performance, single codebase for mobile + desktop + TV, Google backing | Dart language (no TS sharing with web), smaller ecosystem for media libraries |
| **Native (Swift + Kotlin)** | Best performance, full platform API access, best video playback | Two separate codebases, 2x development effort |
| **Expo + React Native** | Fastest path from web to mobile, OTA updates, managed native modules | Same RN limitations, Expo abstractions can limit advanced features |

**Recommendation to evaluate:** React Native / Expo is the natural fit given the existing TypeScript + React web stack. Shared types from `@snc/shared`, shared API client patterns, shared business logic. The video playback concern is real but libraries like `react-native-video` (backed by Mux, same as Vidstack) handle HLS/DASH natively on both platforms.

**Codec implications:** iOS and Android both have hardware H.264 and HEVC decode. The current H.264 + AAC baseline works. HEVC renditions would reduce bandwidth on cellular (important for mobile) but add encoding cost. AV1 hardware decode is available on newer devices (iPhone 15+, Snapdragon 888+) but not universal enough yet.

### Tier 3: Living Room Devices

The "lean back" experience. Users watch on TV, interact minimally (remote control navigation).

**Platform breakdown:**

| Platform | SDK/Language | Market Share | Notes |
|----------|-------------|-------------|-------|
| **Android TV / Google TV** | Android (Kotlin/Java), Leanback library | ~35% of smart TVs | Same APK as mobile with TV-optimized UI. Fire TV is also Android. |
| **Amazon Fire TV** | Android (same as above) | ~35% of streaming sticks | Fork of Android TV. Same codebase with minor adjustments. |
| **Apple TV (tvOS)** | Swift / SwiftUI, TVMLKit | ~15% | Separate codebase from iOS (different UI paradigm) but shares Swift |
| **Roku** | BrightScript / SceneGraph | ~30% US market | Completely separate platform. BrightScript is proprietary. |
| **Samsung Tizen** | HTML/CSS/JS (web app in TV shell) | ~20% global smart TVs | Web-based — could potentially reuse web app with TV-optimized layout |
| **LG webOS** | HTML/CSS/JS (web app in TV shell) | ~15% global smart TVs | Same as Tizen — web-based TV app |

**Key insight:** Android TV + Fire TV covers the majority of streaming sticks with a single Android codebase. Samsung Tizen and LG webOS are web-based, meaning the existing web app could be adapted with a TV-optimized layout (10-foot UI, remote-friendly navigation). Roku and Apple TV are fully separate platforms.

**Pragmatic approach:**
1. Android TV app (covers Google TV + Fire TV + most smart TVs with Android) — if building React Native mobile app, Expo/RN for Android TV is possible but immature. Native Android with Leanback is more proven.
2. Samsung/LG — web app in TV shell with 10-foot CSS. Lowest incremental effort.
3. Roku — separate effort, only if audience demands it.
4. Apple TV — separate effort, shares some Swift with native iOS if that path is chosen.

**Codec implications:** All living room devices have hardware HEVC decode. Many newer devices support AV1. H.264 remains the safe universal baseline, but HEVC renditions meaningfully reduce bandwidth for 1080p+ content on these devices.

## Codec & Encoding Strategy

### Live Streaming (ABR)

The FFmpeg sidecar approach (planned on the streaming board) produces multiple HLS renditions from a single ingest stream.

**Proposed rendition ladder:**

| Label | Resolution | Bitrate (H.264) | Bitrate (HEVC) | Target |
|-------|-----------|-----------------|----------------|--------|
| Source | 1080p60 | 6 Mbps | — | Pass-through, no transcode |
| High | 720p30 | 2.5 Mbps | 1.5 Mbps | Desktop, good mobile |
| Medium | 480p30 | 1 Mbps | 600 Kbps | Average mobile |
| Low | 360p30 | 500 Kbps | 300 Kbps | Poor cellular |
| Audio-only | — | 128 Kbps AAC | 128 Kbps AAC | Background listening |

**H.264 first, HEVC later.** The initial ABR implementation should produce H.264 renditions only (universal playback). HEVC renditions can be added as an optimization pass when mobile/TV apps exist to consume them. The VAAPI hardware encoder on the i7-10700 supports both H.264 and HEVC.

**Audio-only rendition** is particularly valuable for S/NC's music streaming use case — listeners can switch to audio-only to save battery/bandwidth without disconnecting.

**HLS master playlist** with `EXT-X-STREAM-INF` tags — SRS generates this natively when fed multiple renditions. Vidstack and native mobile players handle ABR switching automatically.

### VOD Transcoding

The media pipeline (separate board) already plans for H.264 + AAC as the universal transcode target.

**Multi-codec VOD encoding** (future):
- **H.264 + AAC** — universal baseline, always produced
- **HEVC + AAC** — bandwidth optimization for mobile/TV apps. Produce alongside H.264 when mobile apps exist.
- **AV1 + Opus** — future, when hardware decode is universal enough (~2027-2028). Best compression but encoding is slow even with hardware.

Storage cost for multi-codec: roughly 1.4x (HEVC at ~60% the size of H.264). Garage S3 storage is cheap; encoding time is the real cost.

### Codec Decision Matrix

| Codec | Live ABR | VOD | Web | Mobile | TV | When |
|-------|---------|-----|-----|--------|-----|------|
| H.264 + AAC | Yes | Yes | Yes | Yes | Yes | Now (universal) |
| HEVC + AAC | Later | Later | No (Firefox) | Yes | Yes | When mobile/TV apps ship |
| AV1 + Opus | Future | Future | Partial | Partial | Partial | When hardware decode is universal |

## Shared Infrastructure Requirements

Things that need to work across all clients:

### API Contract

The REST API (`/api/*`) is already platform-agnostic. Mobile and TV apps would be API consumers alongside the web app. Key considerations:

- **Auth tokens**: Better Auth currently uses session cookies. Mobile apps need token-based auth (Bearer tokens). Better Auth supports this but it needs to be enabled.
- **Streaming URLs**: HLS URLs are returned by `/api/streaming/status`. These work on any platform.
- **Content delivery**: VOD URLs point to Garage S3. Direct URLs work; signed URLs would be needed for subscriber-only content on native apps (no cookie-based auth).
- **Push token registration**: New endpoint for mobile apps to register device push tokens.

### Content Delivery

- **Live HLS**: Served by SRS → Caddy proxy. Works for all clients.
- **VOD**: Served from Garage S3. Works for all clients. Consider CDN edge caching if audience grows beyond single-server capacity.
- **Offline downloads**: Subscriber feature for mobile. Requires signed time-limited download URLs + DRM consideration (or accept the piracy risk for a cooperative platform).

## What to Protect in Current Architecture

Decisions being made now that affect multi-platform feasibility:

1. **API-first design** — Already in place. The Hono API serves JSON; the web app is a separate consumer. Mobile/TV apps would be additional consumers. No server-rendered HTML dependencies.

2. **HLS as the delivery protocol** — Correct choice. HLS is supported natively on iOS, Android, smart TVs, and all browsers. DASH adds complexity with minimal benefit for this use case.

3. **H.264 + AAC as universal baseline** — Correct. Don't skip this in favor of HEVC-only. Always produce H.264 renditions.

4. **Shared types in `@snc/shared`** — The Zod schemas and TypeScript types are reusable in React Native. If going native, the schemas can generate API documentation for native developers.

5. **ABR rendition ladder** — When implementing the FFmpeg sidecar, include an audio-only rendition from the start. It's trivial to add and high-value for music streaming on mobile.

6. **Auth token support** — When implementing any auth changes, ensure Better Auth's token-based auth is available alongside session cookies. This unblocks mobile app development without rearchitecting auth.

## Rough Effort Estimates by Platform

Not estimates of time — estimates of relative complexity:

| Platform | Effort | Reuse from Web | Notes |
|----------|--------|---------------|-------|
| React Native (iOS + Android) | Large | High (TS, shared types, API patterns) | Single codebase for both platforms |
| Android TV / Fire TV | Medium | Medium (API client, business logic) | Leanback UI is Android-specific |
| Samsung Tizen / LG webOS | Small-Medium | Very High (web app with TV CSS) | Web app in TV shell |
| Roku | Large | Low (BrightScript is proprietary) | Completely separate codebase |
| Apple TV (tvOS) | Large | Low-Medium (Swift, shares some iOS if native) | Separate codebase |

## Recommended Expansion Order

1. **ABR + audio-only rendition** — prerequisite for good mobile experience (planned on the streaming board)
2. **Auth token support** — unblocks all native app development
3. **React Native mobile app** (iOS + Android) — highest impact, most audience reach
4. **Android TV / Fire TV** — extends Android codebase to living room
5. **Samsung/LG web-based TV app** — low effort if web app is responsive
6. **Roku / Apple TV** — only if audience demands justify separate codebases

## Open Questions

- **DRM for subscriber content on native apps**: Web uses cookie-based auth for gating. Native apps need a different approach. Full DRM (Widevine/FairPlay) is complex and philosophically misaligned with cooperative values. Signed URLs with expiry may be sufficient.
- **Offline playback licensing**: Downloaded content needs some protection against redistribution. Or do we accept the "honor system" approach aligned with cooperative trust?
- **Push notification provider**: FCM (Firebase Cloud Messaging) covers Android + web push. APNs for iOS. Unified providers like OneSignal abstract both but add a dependency.
- **React Native video library maturity**: `react-native-video` v6+ is maintained by Mux (Vidstack's backer). Evaluate whether it handles HLS ABR, background audio, and PiP adequately before committing to RN.

## References

- `video-codec-compatibility.md` — codec support matrix
- `streaming-server-evaluation.md` — SRS capabilities
- `irl-streaming.md` — mobile/field streaming hardware
- `media-player-libraries.md` — Vidstack selection, Video.js v10 watch (decision record at `../.memory/decisions/platform-0004-vidstack-media-player.md`, promoted 2026-04-16)
- `../../org/research/competitive/streaming.md` — Twitch/YouTube/Kick comparison
- Streaming board (parent monorepo) — ABR transcoding item under Competitive Parity
- `boards/platform/media-pipeline/BOARD.md` — VOD transcoding pipeline
- `boards/infra/guides/streaming-deploy-phase1-2.md` — VAAPI hardware encoding setup
