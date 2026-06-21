---
id: creator-page-host-when-offline
kind: story
stage: backlog
tags: [streaming, live-experience]
release_binding: null
created: 2026-06-21
updated: 2026-06-21
---

# Creator-to-creator hosting (presentation re-point, viewer layer)

## Idea
A creator's public page, when that creator is **offline**, displays another creator's live
stream — Twitch-style "hosting." The viewer lands on creator A's page and sees creator B's
broadcast embedded, with attribution.

## Why this is NOT editorial carry (load-bearing distinction)
This is a **presentation re-point**, not media-layer composition. The creator page's loader
checks "am I live? no → is a host target set? yes → render the target's existing HLS player."
No Liquidsoap edge, no pipeline carry, no re-encode, no cycle-detection-in-the-media-graph.

Contrast with S/NC TV's `channel-as-source` carry, which IS media-layer composition: one
continuous linear broadcast (single HLS output) that seamlessly cuts to a live creator and back
*within one stream* (`fallback([live, queue, pool, blank])` with Liquidsoap transitions). That
mechanism exists because S/NC TV is a curated linear channel that must never blink to black. A
creator page is not a linear channel — it's a page, and a page can simply choose which existing
stream to embed. Using media-layer carry here would be re-encoding B's stream into A's pipeline
to solve a problem the viewer client already solves for free.

This is why the `unified-channel-model-creator-enablement` feature deliberately did NOT relax
the creator carry guard (`editorial-config.ts:149`): creator-to-creator hosting is a
`live-experience` (viewer presentation) concern, and presentation re-point is the right
mechanism for it.

## Sketch (when picked up)
- Creator page loader: derive live-state; if offline and a host target is configured, resolve
  the target's HLS and render the player pointed at it (attribution UI).
- A way to set/clear the host target (creator manage), and to opt out of being hosted
  (consent) — the product/safety surface that media-layer carry would also have needed.
- Belongs under the `live-experience` epic (viewer presentation of creator channels), not the
  `unified-channel-model` editorial epic.

## Scope note
Product questions to resolve at pickup: host-target consent (does B agree to be hosted?),
paywalled-creator handling (can A host B's gated stream?), and moderation of hosted content.
These are presentation-layer policy, lighter than the media-graph version but not zero.
