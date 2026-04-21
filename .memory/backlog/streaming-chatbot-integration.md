---
tags: [streaming, community]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Chatbot Integration Support

Allow creators to connect external chatbots to their live chat rooms. The platform exposes a chatbot API (authenticated WebSocket or REST endpoint) that bots can use to read messages and post replies. Enables automated moderation bots, loyalty point bots, and custom engagement bots without requiring them to be first-party features.

## Pattern references

See [live-streaming-ux-patterns.md §3.9 Ecosystem mod tools](../research/live-streaming-ux-patterns.md) for the Twitch bot ecosystem reference (Nightbot, Fossabot, StreamElements, Sery_Bot) and the co-op-aligned posture recommended by research:

- **Open bot framework** over proprietary platform features — lets communities self-host tools rather than depending on a central vendor.
- **Published uptime SLA + rate limits** on the bot API.
- **Audited permission scopes** — bots declare what they read/write; users can inspect; revocation is one click.
- **Bots as chat participants** — they appear as bot-tagged users in chat, actions are visible, moderator log treats them like any other moderator.

Research §3.10 (governance-aligned patterns) notes that a cooperative should provide *first-class primitives* for the most common bot use-cases (welcome messages, regex/substring filters, auto-moderator actions) so basic functionality isn't bot-dependent — while keeping the bot API open for advanced/community-specific needs.

## Scoping notes

- Consider splitting the item: (1) bot API primitives (auth, WS endpoint, REST); (2) native-built-in versions of the top use-cases (welcome, regex filter, timed announcements) from research §3.10.
- Security: bot tokens separate from user tokens; bot rate-limits stricter than user rate-limits; bot actions logged distinctly from moderator actions in `chat_moderation_actions` table.
- Moderation overlap with `feature-chat-moderation`: bots issuing `timeoutUser` / `banUser` via the API need the same authorization layer; no new permissions infrastructure required.
