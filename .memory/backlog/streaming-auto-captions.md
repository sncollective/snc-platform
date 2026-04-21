---
tags: [streaming, media-pipeline]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Auto-Captions

Speech-to-text on the live audio stream to generate real-time captions (accessibility) and searchable transcripts (discovery). Runs as a sidecar process consuming the SRS HLS output or a tapped audio stream, producing WebVTT segments synced to the player. Useful for both live caption overlays and post-stream transcript storage on VOD recordings.

## Pattern references

See [live-streaming-ux-patterns.md §1.7 Accessibility](../research/live-streaming-ux-patterns.md) and [§6 Accessibility cross-cutting](../research/live-streaming-ux-patterns.md):

- **No major incumbent solves live captions well.** Twitch and YouTube Live offer post-stream transcripts (~24h delay), not real-time. ASR-generated live captions exist but are "not WCAG-conformant" — research explicitly flags this.
- **Caption delivery format** — WebVTT is standard; HLS can embed via in-band CEA-608 or side-loaded `.vtt` files. Vidstack player supports both.
- **User customization expected** — font family, size (75–200%), colour, background colour + opacity, edge style (outline / drop-shadow / raised / depressed). Table-stakes per §6; incumbent platforms all expose these.
- **Third-party CART providers** can inject WebVTT mid-stream when better quality is needed than ASR can produce. Opportunity to support professional captioners as an option, not a default.

## Scoping notes

- Live ASR quality is acceptable for *discovery* (transcript search, post-stream indexing) and *assistance* (viewers with hearing loss who prefer imperfect captions to none) but inadequate for *compliance* (formal a11y obligations). Mark the user-facing caption UI with a "auto-generated" label so expectation is clear.
- Reduced-motion handling (§6) is orthogonal but worth co-scoping with captions — animated caption pop-in can cause motion sensitivity issues.
- Pairs naturally with [streaming-subtitle-delivery-player](streaming-subtitle-delivery-player.md) — both terminate in the same Vidstack `<Track>` API.
