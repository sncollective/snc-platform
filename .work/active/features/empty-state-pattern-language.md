---
id: empty-state-pattern-language
kind: feature
stage: review
tags: [design-system, ux-polish]
parent: visual-identity-exploration
depends_on: []
release_binding: null
gate_origin: visual-identity direction #2 + org empty-state voice brief (2026-08-15)
created: 2026-08-15
updated: 2026-08-15
---

# Empty-state pattern language

Org's brief (org/.mockups/design-system/empty-state-voice-brief.md) owns the words; platform
owns the patterns. Principles that shape the pattern language: signal-not-noise; expectation
+ ONE honest door; grammar quiet (off-air excepted — TV voice); degraded ≠ abandoned
("unloaded must never be indistinguishable from missing"); compact band, never dead section.

## Pattern components to design (mockup exploration first)

1. **EmptyBand** — the compact band pattern (Coming Up / feed / merch): mark-or-slash
   moment, one line (brief's exemplars), one door (action link/button).
2. **MonogramAvatar** — no-avatar treatment: spine-type initials + deliberate ground/border
   (reads "person not yet photographed", not broken image). Sizes: card 80px, press hero.
3. **ScrimHero** — designed degradation for type-over-variable-imagery (press light hero).
4. **OffAirSlate** — the TV-voice exception (rides with live-off-air work).

## Stories

1. `empty-state-patterns-mockup` — done. The four patterns are rendered against visibly marked
   reference copy in both modes and verified by a vision-capable reviewer.

## Future operator decision (not scoped)

Production component extraction and route rollout may be scoped only after the operator reviews
and selects from the mockup. No rollout story exists in this feature's current boundary.

## Operator decisions (2026-08-15, relaunch scope)

- **MOCKUPS ONLY** — phase 2 (component extraction + route rollout) is a separate future
  decision after operator reviews the mocks.
- **All copy in mocks = marked placeholders.** Org's brief exemplar lines are reference
  drafts rendered as `PLACEHOLDER — pending human copy pass`; no unapproved voice ships.
  Copy-work is human-in-the-loop from here on.

## Mockups

- Exploration: `.mockups/design-system/empty-states/index.html`
- Status: vision-verified at 1280px and ready for operator review; no production direction selected.

## Implementation notes

- Mockups-only scope completed through child story `empty-state-patterns-mockup`.
- EmptyBand, MonogramAvatar, ScrimHero, and OffAirSlate each render in-context and isolated in
  dark and light, with structural notes grounded in “unloaded ≠ missing” and one-honest-door.
- All product copy is visibly governed as `PLACEHOLDER — pending human copy pass`; exemplar lines
  are reference drafts, not final voice.
- Two visual passes ran in one `openai-codex/gpt-5.6-sol` vision session with one implementation
  iteration between them. The second pass verified the artifact for operator review at 1280px.
- No components, routes, production tokens, public assets, or sibling work-item paths changed.
- Rollout remains a separate future operator decision; feature review is the visual-alignment
  handoff, not permission to ship these patterns.
