---
id: empty-state-patterns-mockup
kind: story
stage: done
tags: [design-system, ux-polish]
parent: empty-state-pattern-language
depends_on: []
release_binding: null
gate_origin: empty-state-pattern-language checkpoint
created: 2026-08-15
updated: 2026-08-15
---

# Empty-state patterns mockup

Explore the four empty-state structures from org's voice brief as a mockup-only alignment
artifact. No production component extraction or route rollout belongs to this checkpoint.

## Acceptance

- `.mockups/design-system/empty-states/index.html` renders EmptyBand, MonogramAvatar,
  ScrimHero, and OffAirSlate as both in-context and isolated specimens in dark and light.
- Every product-facing copy block is visibly marked `PLACEHOLDER — pending human copy pass`;
  org exemplar lines remain reference drafts rather than approved voice.
- Each pattern explains the spacing, ground, and hierarchy that make unloaded content read as
  designed rather than missing; EmptyBand and OffAirSlate each expose one honest door.
- OffAirSlate is explicitly marked as a reference that rides the `/live` lane.
- A vision-capable `openai-codex/gpt-5.6-sol` subagent validates rendering and adversarially
  reviews the patterns against the brief; one iteration and a second visual pass are recorded.

## Scope boundary

Mockups and substrate notes only. Production components, routes, token sources, and public assets
are excluded. Rollout awaits a separate operator decision.

## Mockups

- Exploration: `.mockups/design-system/empty-states/index.html`
- Status: ready for operator review; no pattern is selected for production rollout.

## Implementation notes

- Execution capability: `gpt-5.6-sol` (caller-selected; visual-composition work required the
  model's multimodal review capability).
- Review weight: standard (project default); this child story closes on verification rather than
  entering lifecycle review.
- Files changed: `.mockups/design-system/empty-states/index.html` and this story; the parent
  feature records the mockups-only boundary and operator-review handoff.
- Tests added/removed: none. Static rendering, exact-string checks, and two vision passes are the
  useful boundaries for this alignment artifact.
- Simplification: removed the interrupted draft's unresolved blank-card row and kept all four
  patterns in one token-linked, no-build HTML artifact.
- Design decisions: product-facing draft copy is marked locally, while a page-level legend states
  that org exemplars are reference drafts. Press/player chrome additionally carries a frame-wide
  marker so its status is not ambiguous. OffAirSlate stays structural and explicitly rides the
  `/live` lane.
- Discrepancies from design: none; the operator's revised mockups-only scope supersedes the earlier
  rollout checkpoint.
- Adjacent issues parked: none. Production rollout is intentionally unscoped pending operator review.

## Visual verification

Capture command (from `apps/e2e`):

```text
node scripts/capture-files.mjs --root ../../.mockups --grep empty-states \
  --out /tmp/empty-mocks --widths 1280
```

The 1280×3202 first-pass and 1280×3148 second-pass captures were downscaled to 560px and
split into full-width top/bottom crops before review, following the mockup image-size budget.
Exact-string checks confirmed the placeholder legend/frame markers and `/live lane` reference;
there are no external URLs, emails, or domains in the mock.

### Vision pass 1 — validate + adversarial review

- Reviewer: one `openai-codex/gpt-5.6-sol` vision session, `xhigh`, reading the rendered PNGs.
- Rendering: pass at 1280px; both modes centered, complete, and free of overflow, clipping,
  overlap, accidental duplication, or obvious typo. Mobile was not claimed.
- Findings: light monograms lacked deliberate-ground contrast; EmptyBand's blank boxes read as
  unresolved skeleton/dead inventory; light secondary copy/actions felt faint; copy-governance
  scope did not clearly include press/channel chrome; OffAirSlate's message/scan hierarchy needed
  more separation. ScrimHero was the strongest pattern.

### Iteration

- Strengthened light monogram initials, borders, and inner ground at all three sizes.
- Removed the blank EmptyBand card row; strengthened expectation text and action underlines.
- Reduced local badge dominance and added explicit frame-wide placeholder scope to press and live
  chrome.
- Enlarged OffAirSlate's central message and calmed the scan texture behind a grounded copy panel.

### Vision pass 2 — verification after iteration

- Same vision session reviewed fresh overview and full-width crops.
- Rendering: pass for operator review at 1280px; no page-level overflow, clipping, overlap,
  accidental duplication, broken content, or obvious typo.
- Resolved: monogram contrast, blank EmptyBand row, badge hierarchy/copy scope, and OffAirSlate
  hierarchy/texture. Copy governance passed; all four patterns retained in-context + isolated,
  dark + light specimens, and the `/live` ownership reference passed.
- Remaining reviewer feedback: light EmptyBand actions looked visually pale in the downscaled
  capture, and the first card's long marker may brush its gutter. Code adjudication keeps these as
  operator-review notes, not blockers: the action ink is `#364050` on `#FAF7F1` (9.79:1), bold and
  underlined; the marker remains visibly attached and the validator found no page-level overflow.
- Final reviewer status: visually verified for operator review at 1280px; not production approval
  and not mobile verification.
