---
tags: [community, ux-polish]
release_binding: null
created: 2026-04-20
---

# Chat reactions render below message (not beside)

Reaction pills + the `+` trigger currently render to the right of each chat message (same row as the content). Standard chat-UX convention (Slack, Discord, iMessage, Twitch) is to render reactions **below** the message content, left-aligned under the content column.

Surfaced during the `design-system-adoption` review (2026-04-20) as a non-blocking observation after the reaction picker trigger visibility bug was fixed.

## Scope when picked up

Layout change in `apps/web/src/components/chat/chat-panel.module.css`:

- Change `.reactionRow` from the inline-right position to a block-level row that appears after the message content, aligned under it (use the existing `margin-left: calc(20px + var(--space-xs))` which already aligns past the avatar).
- Verify the `.message` container's flex direction accommodates the reaction row dropping to a new line without reflowing the username/badges row.
- Ensure long messages (multi-line word-wrap) still have reactions appear under the last line cleanly.
- No change to reaction-picker component itself — the trigger already flows with the row.

Small; probably inline-implementable in a single session.
