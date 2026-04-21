---
tags: [streaming, community]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Chat Reactions, Polls, and Chat Commands

Interactive live chat features: emoji reactions on messages, real-time polls (creator-initiated, viewer-respondable), and a chat command system (e.g., `!uptime`, `!socials`, custom creator commands). All require WebSocket infrastructure extensions and UI components in the chat panel.

## Status 2026-04-21

Reactions half is in-flight — `feature-message-reactions` (at `stage: review`, currently with an addendum to move reaction-row layout from right-of-message to below-message, and a model-level revisit flag for floating-burst vs per-message). This item should be narrowed to **polls + chat commands** when scoped next, or split into two items. Reactions are not a greenfield problem anymore.

## Reactions — before scoping further work

Research §2.5 identifies three distinct reaction models:

1. **Per-message reactions** (Discord convention) — what `feature-message-reactions` ships. Lower-priority for live pacing; earns its keep in Q&A / clip-worthy moments.
2. **Floating-burst** (YouTube Live's pattern) — aggregate emoji animate up from the bottom of the player; anonymised; research calls this *"the most useful low-friction primitive"* for live engagement.
3. **Aggregate engagement trackers** (Twitch Hype Train, Channel Points) — meters + overlays triggered by sub/bit/redeem events. Different shape from reactions proper.

The model-level revisit is already flagged on `feature-message-reactions` under `## Revisit if`. Options if reactions get a second pass: keep per-message layout-fixed, add floating-burst alongside, or replace per-message with floating-burst. Don't respec reactions in this item — it belongs to that feature.

## Polls — pattern signals

Research §4 (engagement overlays) treats polls as a standard creator-initiated primitive: 2–5 options, chat-anchored panel, live result bars, timed duration. Twitch and YouTube both ship this. Not a hard design problem per se, but scope touches moderation (who can start a poll — creator, mods, VIPs? — and who can vote — authenticated viewers, subs only, followers?) and accessibility (results in screen-reader-friendly form, not just colour bars).

## Chat commands — pattern signals

Research §2.2 lists Twitch's native slash commands (`/me`, `/slow`, `/ban`, `/timeout`, `/pin`, etc.) as admin/meta actions, and §3.9 documents the third-party bot ecosystem (Nightbot, Fossabot, StreamElements) that covers the `!uptime`/`!socials`/custom-response space. Two distinct surfaces:

- **Slash-commands** — platform-native admin/meta actions already partly shipped via `/timeout`, `/ban`, etc. in the chat-moderation feature. Extending this is straightforward.
- **Bang-commands** — user-facing info/entertainment responses (`!uptime`, `!discord`). Either:
  - Ship a native primitive (creator defines command + response; server returns on invocation), or
  - Ship a bot API + reference bot, keeping command logic in community-hosted extensions.

Research §3.9 recommends the latter for a co-op platform — open bot framework with published uptime SLA and audited permission scopes. The tradeoff is native-ships-faster vs bot-API-is-more-aligned-with-co-op-principles.

## Pattern references

See [live-streaming-ux-patterns.md](../research/live-streaming-ux-patterns.md):

- **§2.5 Reactions** — three models compared; floating-burst vs per-message is the central question for live.
- **§2.2 Composer** — slash-command convention and composer rate-limit/emote-picker patterns for command-adjacent UX.
- **§3.9 Ecosystem mod tools** — bot framework vs native primitive tradeoff for custom commands.
- **§4 Engagement overlays** — polls, predictions, channel points (polls is the relevant sub-pattern here).

## Scoping notes

- Consider splitting into two items — **polls** and **chat commands** — when scoped. Reactions belong to `feature-message-reactions`; this item's original framing bundles three separate concerns.
- Polls is likely feature-sized (schema + lifecycle + UI + moderation).
- Chat commands likely splits into two decisions: extend slash-commands (small, inline/story) and whether to ship bang-commands natively or via a bot API (feature-sized with a real architectural choice).
