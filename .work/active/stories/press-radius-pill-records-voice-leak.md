---
id: press-radius-pill-records-voice-leak
kind: story
stage: implementing
tags: [brand, press]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Shared --radius-pill leaks round corners into Records press surfaces

`--radius-pill: 999px` is a shared geometry token (`styles/tokens/geometry.css`)
with no per-voice override, while every other radius alias is voice-resolved
(`[data-route="records"]` → `--voice-records-radius: 0px`, per the Records
square/raw-ink brand character). The press components use `var(--radius-pill)`
for the for-fans-of tags, listen links, and PDF-download CTAs
(`press-sections.module.css` lines ~99, ~186, ~207), so the Records-voiced
public press page and the exported EPK one-pager PDF carry fully rounded pills
on an otherwise square-cornered surface.

Visually confirmed in the 2026-09-02 cycle-2 EPK PDF render. Small, but it is
the one element class that visibly deviates from the Records voice on the most
public brand surface the platform currently ships.

Fix options to weigh at scoping: add `--radius-pill` to the per-voice radius
families (records → 0px or a modest 2px), or switch the press pill usages to
`--radius-sm`/`--radius`. Check the no-leak CSS checker's scope — it did not
catch this, which may be its own small gap.
