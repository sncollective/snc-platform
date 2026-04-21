---
tags: [streaming, commerce, community]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Patron Badges in Live Chat

Display subscription-tier badges next to patron usernames in live chat. Requires subscription tier data from the commerce layer and a badge rendering component in the chat message UI. Part of Chat & Interaction beyond MVP.

## Pattern references

See [live-streaming-ux-patterns.md §2.1 Message rendering](../research/live-streaming-ux-patterns.md) for badge conventions:

- **Placement** — badges sit *left of username* in the message line. Standard order: mod → VIP → subscriber → bits-cheer → partner/staff/founder. Multiple badges stack in priority order.
- **Tier visuals** — Twitch customizes subscriber badges by tier + tenure (1mo / 3mo / 6mo / 1yr / 2yr / ... / 10+yr); Partners extend this further. Icon + colour together signal role — never colour alone (accessibility).
- **Contrast** — rendered contrast-safe against both light and dark mode message backgrounds; research §6 flags AA minimum.

## Scoping notes

Existing badge infrastructure in `feature-chat-moderation` already renders admin + creator-owner badges via `data-badge` attribute + CSS. Extend that system rather than building a second mechanism — subscription tier is just another badge variant.
