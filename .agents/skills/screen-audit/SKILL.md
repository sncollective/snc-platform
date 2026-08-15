---
name: screen-audit
description: >
  Capture and adversarially review the REAL app's public screens (not mockups — use
  mockup-review for .mockups/**). Captures public routes in both modes at desktop + mobile
  widths via scripts/capture-screens.mjs, then dispatches vision-capable reviewers with the
  adversarial lens catalog. Use when the user asks to audit/review/inspect live screens,
  verify visual identity on the real app, before/after a visual change, or when a work item
  touches public-facing surfaces and needs visual evidence. The orchestrator model is NOT
  multimodal — every visual claim MUST come from a vision-capable subagent that read the PNG.
---

# Screen audit — capture + adversarial review of live public screens

**Permanent constraint (same as mockup-review):** the orchestrator cannot see images.
Vision-capable subagents (`openai-codex/gpt-5.6-sol`) read every PNG; the orchestrator
adjudicates their findings.

## 1. Capture

```bash
cd apps/e2e
node scripts/capture-screens.mjs --out /tmp/screens [--routes ...] [--modes ...] [--widths ...]
```

- Dev web must be up (`pm2 restart web` if stale; the harness does not start servers).
- Default route list = the public-surface inventory in
  `.work/active/features/visual-identity-exploration.md`. Keep them in sync when routes
  change. Pass `--routes` for a focused pass (before/after a change).
- `manifest.json` records captured/failed — check it before reviewing; a 500/timeout page
  is a finding (or a known parked bug), never silently skipped.
- Authed surfaces (manage/admin) need a storage state — out of scope for this harness.

## 2. Adversarial review dispatch

One vision subagent per coherent group (by route family or mode), each given: the PNG
paths, the lens catalog, and the current design-language context (below). Reviewers report
findings with severity + which screenshot; they do NOT edit code.

**Lens catalog (adversarial — "would a designer ship this?"):**
- Hierarchy — is the page's most important thing the most prominent? Where does the eye go first?
- Typography — scale rhythm, line length, pairing; anything shouting/whispering?
- Color & contrast — token discipline (any color that looks off-system?), WCAG visible failures, accent over/under-use
- Spacing & alignment — grid consistency, optical alignment, dead zones, crowding
- Chrome consistency — nav/footer/tab-bar presence + alignment; logo treatment; do surfaces feel like one product?
- Voice/grammar — does the settled voice model read (parent amber grammar, per-item voice punctuation)? Anything fighting it?
- Responsive (390px captures) — overflow, cramped touch targets, nav/tab-bar behavior
- Empty/degraded states — empty lists, placeholder circles, error renders: do they look designed or abandoned?
- Motion/state affordances — visible hover/focus cues in captures where inferable
- Identity — does this screen feel S/NC (brush-script mark, warm spine) or like a template?

**Output contract per reviewer:** findings list — each with `block` / `should-fix` / `nit`,
screenshot filename, what + why + direction. No padding; "no findings" is explicit.

## 3. Context to hand reviewers (current design language)

- Dark: cast60 indigo spine + glow-gold parent accent. Light: papyrus mid + deep amber.
- Parent grammar everywhere; unit voices as item punctuation only (variant D); titles in ink.
- Nav: brush-script S/NC mark (top-left), text-decoration underlines on active links.
- Signature/example chrome was REMOVED by operator ruling (2026-08-15) — pills/chips
  ("24·96", "A1", "We boost the signal") must NOT be present; flag if seen.
- Values are provisional pending stakeholder review — review the STRUCTURE and execution,
  not the placeholder hues.

## 4. Orchestrator discipline

- **fullPage captures LIE about fixed elements** (learned 2026-08-15): the fixed tab bar /
  mini-player stamps mid-canvas over content in stitched full-page images. A "fixed chrome
  overlaps content" finding from a fullPage capture MUST be re-verified with a real-viewport
  capture at the scrolled position before it is filed.
- **Mind the vision read budget**: very tall captures (>~1MB / >2500px) can fail the
  subagent's image read as "file does not exist". Downscale first:
  `ffmpeg -y -i <tall>.png -vf scale=560:-1 <tall>-small.png` (verified 2026-08-15).
- Adjudicate every finding against code reality before filing/fixing; park or file per
  materiality (workflow rules apply).
- Pair visual findings with code-level checks where possible (a mis-sized logo is a CSS
  read; a "feels bland" is a direction question for the brainstorm, not a bug).
- Before/after verification of any visual change = re-capture the focused routes + one
  vision pass confirming the delta. Never claim "verified" without the pass.


## Mechanism & research record (2026-08-15)

Playwright via the repo's `@snc/e2e` install (shared rendering engine with the e2e suite,
no new dependencies). Ecosystem check: `@m64/pi-screenshot-tools` is desktop/terminal
capture (wayland/kitty — needs a GUI session; different job); no pi-native tool renders
HTML to images (`fetch_content` extracts text; `@image` reads existing files). Re-evaluate
if a pi-native page renderer appears. Sibling skill: `mockup-review` (static `.mockups/`
files — same mechanism, `capture-files.mjs`).
