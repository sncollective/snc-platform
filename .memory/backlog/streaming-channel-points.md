---
tags: [streaming, community, commerce]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Channel Points / Engagement Currency

A per-channel engagement currency that viewers earn by watching and participating. Points can be redeemed for channel rewards defined by the creator (e.g., highlight a message, request a song, unlock an emote). Requires a points ledger, accrual logic (time-watched + interactions), and a rewards redemption flow in the live chat UI.

## Pattern references

See [live-streaming-ux-patterns.md §4 Engagement overlays](../research/live-streaming-ux-patterns.md) for context:

- **Channel Points** (Twitch) — per-channel currency earned by watching + participating; redemptions trigger chat messages or automated actions (sound, emote-only mode, etc.). Research names this as a known pattern without taking a position on co-op alignment.
- **Hype Train** (Twitch) — aggregate engagement meter triggered by sub/bit/redeem events; fires overlay + system message on activation. Adjacent pattern to channel-points, typically bundled.
- **Super Chat pin-by-amount** (YouTube) — research explicitly flags amount-driven pinning as a known anti-pattern for co-op values; pin-by-intent preferred. If redemptions include "pin my message" as a reward, scope with research §2.7 (pinned & announcement messages) in mind.

## Co-op alignment note

The Twitch model couples points accrual with watch-time for monetization incentive. A cooperative platform may want to decouple — reward participation (messaging, reactions, contributing) rather than just passive watch-time, to avoid the attention-economy pattern research §3.10 (governance-aligned patterns) implicitly opposes. Scope decision point.
