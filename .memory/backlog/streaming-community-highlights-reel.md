---
tags: [streaming, community]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Community Highlights Reel

A curated reel of best clips from streams and VODs, assembled by creators or surfaced by viewer vote. The reel appears on creator or channel pages and gives the community a way to surface standout moments. Depends on the clip creation feature producing clip items that can be ranked and aggregated.

## Pattern references

See [live-streaming-ux-patterns.md](../research/live-streaming-ux-patterns.md):

- **§1.3 Control bar — clip button** — the source mechanism. Clips produced by the Twitch-shape clip flow (30s pre + 30s post, in-player-modal) become the atoms a reel aggregates.
- **§4 Engagement overlays** — system-messages-in-chat are the template for making community events visible; a "new highlight added to reel" event could surface similarly.

Research doesn't document a dedicated highlights-reel pattern — Twitch's clips dashboard is the closest analog but that's browsing-oriented rather than curated. This feature is closer to original territory than incumbent mimicry.

## Scoping notes

- Core decision: who curates? Creator-only, viewer-vote, or both. Co-op-aligned default is likely viewer-vote-with-creator-override; research §3.10 implicitly supports community ownership.
- Ranking mechanics: view count, reaction count (if `feature-message-reactions` extends to clips), view-duration, or explicit up/downvote. Downvotes on a co-op platform are friction territory — consider up-only to avoid gameable harassment vectors.
- Depends on [streaming-clip-creation](streaming-clip-creation.md) shipping first — clips must exist as rankable items.
- Frequency: per-stream highlights, weekly reels, or always-on top-rated? Different UX shapes per choice.
