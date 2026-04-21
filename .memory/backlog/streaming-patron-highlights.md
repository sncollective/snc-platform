---
tags: [streaming, community, commerce]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Patron Highlights and Supporter Shoutouts

Surface patron activity during live streams: highlight new subscribers/patrons in chat with a distinct visual treatment, give creators a one-click "shoutout" action to thank a supporter on stream, and show a supporter leaderboard or recent-activity ticker in the stream UI. Encourages patronage by making support visible to the broader audience.

## Pattern references

See [live-streaming-ux-patterns.md](../research/live-streaming-ux-patterns.md):

- **§2.1 Message rendering — system/event messages** — subs, gift-subs, raids all render as distinct styled chat events (coloured callout box, iconography, not a plain username-prefixed line). That's the natural surface for the "new patron" highlight.
- **§2.7 Pinned & announcement messages** — creator-pinned message slot (collapsible, configurable duration) and broadcaster Announcement (gradient banner at top of chat). Natural pattern for manual shoutouts. Research explicitly flags YouTube Super Chat's pin-by-amount as a co-op anti-pattern — **pin by intent only**, not by support amount.
- **§4 Engagement overlays** — Hype Train pattern (aggregate meter + overlay + system message when activated) is the template for a community-wide "recent supporters" ticker if desired.

## Scoping notes

- Three distinct surfaces bundled in one item (inline highlight on message, one-click shoutout, leaderboard/ticker). Likely want to split into ≥2 items at scope time.
- Leaderboard pattern — research §4 is cautious about ranking/competition mechanics on a co-op platform; consider whether "recent supporters (anonymised)" is preferable to "top supporters (ranked)."
