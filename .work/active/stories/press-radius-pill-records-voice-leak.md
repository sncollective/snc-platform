---
id: press-radius-pill-records-voice-leak
kind: story
stage: done
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

## Implementation notes
- Decision: press components consume voice-resolved `--radius-sm` (records → 0px) instead of invariant `--radius-pill`. Rejected the alternative (voice-resolving the global pill token) because the pill is legitimately invariant for functional controls — switch tracks and progress bars must stay fully rounded in every voice; a voice-resolved pill would square them on records routes. Press surfaces are always records-voiced (route-voice maps `/creators/:id/press` → records), so no pill-ness is lost.
- Files changed:
  - `apps/web/src/components/press/press-sections.module.css` — `.pill` (for-fans-of tags), sticky listen CTA, `.pdf` download CTA → `--radius-sm`
  - `apps/web/src/components/press/streaming-services.module.css` — mobile service chip → `--radius-sm`
  - `apps/web/tests/unit/styles/color-leaks.test.ts` — new guard "keeps press surfaces on voice-resolved radius aliases only": components/press/** CSS may not consume `var(--radius-pill)`. Deliberately scoped to the pill token only — `--radius-circle` stays allowed (the carousel's 46px circular pager control is functional identity; the first guard draft flagged it and was narrowed after inspection).
- Verification: web unit suites green (67 tests incl. the new guard and all press component tests); live one-pager PDF re-render; vision-subagent visual pass — tags/listen chips/CTAs square, consistent with the rest of the surface, no clipping or broken borders.
- Discrepancies from design: none (item offered both fix options; the per-usage switch chosen with rationale above).
- Adjacent issues parked: none.

## Review record (2026-09-02, bounded inline pass — standalone story)
- Token-class reasoning verified against all --radius-pill consumers (switch/progress/manage/live/media-picker keep the invariant pill — controls and app chrome, not brand surface).
- Checker guard tests the actual regression (press pill leak) without over-blocking circular functional elements.
- Verdict: pass. stage: review → done.
