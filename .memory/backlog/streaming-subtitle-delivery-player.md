---
tags: [streaming, media-pipeline]
release_binding: null
created: 2026-04-20
updated: 2026-04-21
---

# Subtitle Delivery to Player

Deliver subtitle tracks extracted during Phase 5 playout ingest to the Vidstack player via WebVTT. Depends on subtitle tracks being stored during Phase 5 ingestion (already done). The wiring from stored WebVTT files to the Vidstack `<MediaPlayer>` track selection API is the remaining work.

## Pattern references

See [live-streaming-ux-patterns.md §1.7 Accessibility](../research/live-streaming-ux-patterns.md) for caption/subtitle UX conventions:

- **User customization expected** — font family, size (75–200%), colour, background colour + opacity, edge style (outline / drop-shadow / raised / depressed). Incumbents all expose these; user-set preferences should persist per-device.
- **Track selection UI** sits in the settings/gear menu: `off → language 1 → language 2 → off`. `c` keyboard shortcut cycles state on Twitch/YouTube.
- **Rendering** — WebVTT positioned at the bottom-center of the player with semi-transparent background; text respects user-set preferences.

Vidstack skill reference at `.claude/skills/vidstack-v1/SKILL.md` covers the Track API surface.

## Scoping notes

- Pairs naturally with [streaming-auto-captions](streaming-auto-captions.md) — both terminate in the same Vidstack `<Track>` API. If auto-captions also lands, the UI needs to distinguish "author-provided" vs "auto-generated" as a label/indicator per §1.7.
- Preference persistence is cross-cutting — if user sets caption size/colour on one video, it should apply to all subsequent videos. Local storage on the Vidstack config is appropriate.
