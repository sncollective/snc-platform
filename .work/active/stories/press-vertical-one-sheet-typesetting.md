---
id: press-vertical-one-sheet-typesetting
kind: story
stage: done
tags: [press, design-system]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-02
updated: 2026-09-02
---

# Vertical one-sheet typesetting polish (operator taste pass)

Operator flagged "fonts/spacing seem off" on the settled band-EPK artifact
(vertical one-sheet, dark). Campaign decomposed into six findings; measurement
pass on the live render adjudicated them:

- CONFIRMED, density-rooted: **compact tier is active** for the full config
  (member thumbs 46px, highlight 58px = compact specs) — several rhythm
  complaints trace to tier compression. Tier stays (it is what makes the
  content fit); internal rhythm gets fixed at the compressed tier.
- CONFIRMED: eyebrow→link gaps tight (10px blank); section rhythm uneven
  (Members→Highlights 28px vs Live→Listen 47px).
- CONFIRMED: highlight cards top-aligned with ~76px content delta — right
  card reads empty.
- CONFIRMED: bandsintown link carries a 1px underline leaking from page-global
  anchor styling; color token roles are correct (link renders off-white
  --color-text, not maroon — refuted).
- REFUTED: left-edge grid misalignment (all edges at x=304, 0px offset, no
  clipping) — no change.
- CONFIRMED: QR top starts 20px above the LISTEN label; only 12px rule→QR
  breathing room.

## Fix plan (scoped to vertical block of oneSheetCss)
1. `.v-live` padding s3→s4 (uniform section rhythm).
2. `.vertical .kicker{margin-bottom:var(--s2)}` (eyebrow→content gap).
3. `.v-live a{text-decoration:none}` (kill the leaked underline).
4. `.v-highlight{align-content:center}` (center card content in equalized
   rows; border-top stays at cell top for divider continuity).
5. `.v-listen{align-items:start}` (QR top aligns with label top; breathing
   room above footer rule).
Horizontal layouts untouched. Acceptance: re-render + measurement pass shows
balanced rhythm, no underline, aligned QR; light + dark both re-verified.

## Implementation notes
- Root-cause confirmed first (campaign's density question): **compact tier active** for the full config — several rhythm complaints traced to tier compression. Tier retained (it is what fits the content); rhythm fixed at the compressed tier. Normal-density rhythm would require content reduction (campaign lane).
- Findings adjudicated by measurement pass before fixing: left-edge grid misalignment REFUTED (all edges x=304, no clip); "maroon link" REFUTED (renders --color-text off-white; the read was the leaked underline). Underline leak, card dead-space, QR misalignment, rhythm unevenness CONFIRMED and fixed.
- Files changed: `apps/api/src/services/press-pdf.ts` (vertical CSS block only) — `.v-live` padding s3→s4; `.vertical .kicker{margin-bottom:var(--s2)}`; `.v-live a{text-decoration:none}` (kills page-global anchor underline leak); `.v-highlight{align-content:center}` (centers shorter card content; border-top stays at cell top); `.v-listen{align-items:start}` (QR top aligns with label). Horizontal layouts untouched.
- Verification: typecheck + full @snc/api unit suite green; dark + light vertical renders single-page; measurement-verified after-pass: eyebrow gaps 10→15px, underline gone, right-card centering within 7px, QR offset ~0px (was 20), section rhythm 28–39px (was 28–47) with separator-to-eyebrow cadence 14–16px; no regressions (dark cast60, coral accents, thumbnails unclipped).
- Discrepancies from design: none (item's plan executed as scoped; two findings refuted and closed without changes).
- Adjacent issues parked: none.

## Review record (2026-09-02, bounded inline pass — standalone story)
- Scoped to vertical block; horizontal + density-tier behavior unchanged (suite green).
- text-decoration:none is a print-layout affordance consistent with the sheet's non-prose link treatment (the page-level underline rule is for prose links).
- Measurement-driven before/after is the acceptance evidence; operator taste loop continues campaign-side via preview renders.
- Verdict: pass. stage: implementing → done.
