---
tags: [streaming, community]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Chat Replay Synced with VOD Playback

Replay the original live chat alongside VOD playback — messages appear at the timestamp they were sent during the stream. Requires storing chat message timestamps relative to stream start time (or absolute timestamp paired with session metadata) during the live session. The chat replay component syncs to the VOD player's current position.

## Pattern references

See [live-streaming-ux-patterns.md §2 Chat](../research/live-streaming-ux-patterns.md) — the full chat rendering surface applies equally to replay (badges, emotes, mentions, reactions, pinned messages). Specifically:

- **§2.1 Message rendering — timestamps** — replay makes timestamps meaningful in a way live chat doesn't. Show both absolute time (original send time) and relative-to-playhead on hover. Consider whether to show timestamps inline (more useful in replay) rather than hover-only (live convention).
- **§2.3 Replies & threading** — if the live session had Twitch-style inline-grouped replies, replay preserves that grouping.
- **§2.7 Pinned & announcement messages** — preserve pin events and their expirations; replay should re-surface pins at the moment they were pinned and re-hide when they expired.
- **§2 polish signals** — autoscroll logic needs to follow the playhead; pause-on-hover-to-read behaviour continues to apply.

## Scoping notes

- Schema: relative-to-stream-start timestamp is simpler (just an integer offset) but loses absolute-time context. Absolute-timestamp + session-metadata is more flexible; query cost is similar. Pick at `/design`.
- Scrubbing the VOD should snap chat to the new playhead. Chat rewind shouldn't re-trigger reaction animations or system-message sounds.
- Moderation state in replay: if a message was deleted by a moderator during the live session, replay should *also* hide it. Replay respects the final moderation state, not the at-the-time state.
- Reactions (from `feature-message-reactions`): replay either shows reactions that landed during the stream (frozen at stream end) or shows current reactions (dynamic). Probably frozen — reactions during replay should be a new primitive if wanted at all.
