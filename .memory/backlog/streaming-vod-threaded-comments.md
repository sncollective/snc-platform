---
tags: [streaming, community, content]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Threaded Comments on VOD Recordings

Viewer comments on published VOD recordings with threaded reply support. Distinct from live chat (which is ephemeral and session-scoped) — VOD comments persist and are tied to the content item. Scoped to the community features layer; depends on the VOD publish flow producing accessible content items.

## Pattern references

See [live-streaming-ux-patterns.md §2.3 Replies & threading](../research/live-streaming-ux-patterns.md) for the replies-pattern comparison:

- **Twitch inline-grouped** — replies stay in the main feed, grouped visually with the quoted original. Good for live pace; also works well for async comments because all conversation stays in one column.
- **Discord split-panel** — replies open a sub-channel in a side panel; auto-archive after 24h. Heavier, optimized for sustained sub-conversations. Overkill for VOD comments where the conversation typically doesn't sustain the way it does in Discord.
- **YouTube Live flat** — no replies at all. Too thin for VOD comments where replies are core to the value.

Research recommends **inline-grouped** (Twitch shape) as the default for live pacing; for async VOD comments, the same model works and has the benefit of keeping conversation discoverable rather than hidden in side panels.

## Scoping notes

- Overlaps with [content-comments](content-comments.md) — both are threaded comments on content; VOD is just one content type. Either share a comment infrastructure or resolve the duplicate at scope time.
- Moderation: research §3 applies to comments too — channel modes (slow, sub-only), AutoMod equivalents, mod tools, viewer-side safety, audit log. Consider whether VOD comments reuse the live-chat moderation surface (`feature-chat-moderation`) or need a parallel implementation.
- Depends on `streaming-vod-publish-flow` producing accessible content items; not blocked but can't ship without it.
