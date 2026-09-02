---
id: press-quotes-field
kind: story
stage: done
tags: [press, creators, schema]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Press quotes: content field + pull-quote rendering

Campaign relay (operator-supplied, source-verified third-party quote — Fort
Collins Music Association on the band — invisible on the release-candidate
vertical because the vertical renders only longBio para 1). Ask: promote
press quotes to first-class content.

## Design decisions
- `pressQuotes: Array<{text, source, url?}>` — strict on publish (url-validated when present), permissive in draft; mirrors the established field pattern at all 5 shared schema sites + editor model/validation.
- One-sheets render an attributed pull-quote block (accent left rule, display typeface, curly quotes, small-caps attribution): **vertical caps at 1 quote, horizontal at 2** (mirrors the highlights cap philosophy); density tiers compress it (15px → 14/13px).
- Web: `QuotesSection` (up to 3) placed after About in both templates; source renders as a link when `url` present.
- Editor: array fields (text/source/url + add/remove) on the links tab, publish validation (text + source required, full URL when present).

## Implementation notes
- Files: shared `press.ts`, API `press-pdf.ts` (quoteBlock + CSS + caps), web `press-sections.tsx`/`.module.css`, templates A/B, editor model + editor, seed (campaign-supplied verbatim quote per their handoff), fixtures across 7 test files (+`pressQuotes: []`).
- Tests: API unit (vertical renders first quote only with exact markup; horizontal renders 2; absent → no block), web unit (blockquote count, source link href).
- Live verification: seeded + rendered dark vertical/horizontal/one-pager; single page; hardened padding-floor fit check green; pdftotext confirms quote + attribution; measurement pass: quote block 79px, display face 13px vs body 12px vs title 31px (hierarchy correct), curly quotes, accent rule 2px, margins 50/50, no regressions.
- **Density tradeoff recorded**: the quote's ~80px dropped the vertical from compact to tight tier (thumbnails 42px). Measured "noticeable but orderly". Options if the operator wants compact back: campaign trims ~80px of copy (their lane), or accepts tight with the quote. The ladder made the guarantee-holding choice automatically.
- Adjacent issues parked: none.
