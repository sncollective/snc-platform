---
id: showcase-item-voices
kind: story
stage: implementing
tags: [design-system, ui, content]
parent: showcase-voice-presence
depends_on: [showcase-accent-boundary]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
---

# Showcase per-item voices (fallback attribution)

## Brief
Shared dev-free mapping module (content-type fallback: audio→records, video→tv,
podcast/studio-audio→studio, written/none→parent; event types: show→tv,
recording-session→studio). Per-item accents via inline `--item-unit-*` var chains
(`var(--voice-<unit>-accent/-bg/-on-accent)`; parent = no properties). Home RecentContent +
/feed: item title in unit accent (parent→neutral), 1px unit-accent hover border on the card
wrapper. WhatsOn: tv accent on section title. ComingUp: per-event unit label in unit accent,
titles neutral. NO creator chips (deferred to attribution data model — org-accepted).

## Acceptance
- Mapped items show unit accents on both surfaces, both modes; parent items neutral.
- No raw voice consumption outside sanctioned surfaces; no literals (var chains only).
- Attribution-link accent treatment documented as deferred with the chips.
- Suites + build green.
