---
id: press-support-branch-reconciliation
kind: story
stage: review
tags: [press, workflow]
parent: null
depends_on: []
release_binding: null
gate_origin: null
created: 2026-09-03
updated: 2026-09-03
---

# Reconciliation: press-support branch item coverage (pre-merge)

## The deviation, stated plainly

The campaign/press-support branch's later operator-driven polish rounds
landed as direct commits without corresponding `.work/active/stories/`
items. The early and mid arc followed the full lifecycle (scope →
implement → review → done, with notes); the rapid live-review loop of the
finish rounds (title placements, row centering, member-window geometry,
tagline/contact/hero treatments) outpaced item creation. Roughly 40
platform-side commits carry no item file. Campaign content commits
(`press seed: ...`) are their lane's convention and are excluded from
this count.

This reconciliation records the gap honestly and indexes the un-itemed
work to its conceptual parents. It does not fabricate retroactive process
— the commits are the audit trail; this item is the index.

## Commit-range → conceptual home mapping

Un-itemed platform commits fall under three existing scopes:

1. **`single-release-epk` (feature) and its child stories** — the EPK's
   finish rounds: hero treatments (scrim removal, natural floor, title
   placement iterations, luminance-mapped positioning), credit ledger
   rounds (performers/writers grammar, dot suppression, stacking), the
   pre-save callout, triptych composition and v3-v4 rounds, mode-dependent
   body slot, and the tagline accent treatment.
2. **`press-release-one-sheet-cover-art` and the one-sheet follow-up
   stories** — the horizontal/vertical polish: space-between slack
   distribution, bounded row sections, member-window geometry (60px
   class → 4:5 → 4:6 → aspect-derived), horizontal members box-aspect,
   contact grammar unification (inline → stacked → label column), IG
   handles, tagline treatment on both orientations, hero print-spec and
   box-aspect rounds, web hero sync, the hydration-race kill, row
   equalization and centering.
3. **Infrastructure/fixes without items** — the browser-pdf hardening
   rounds (fit-check ancestor exemption, culprit naming), the imgproxy
   q:95 quality fix, the script-blocking route, memberDimensionMemo.

## What this item does NOT do

- Does not retroactively mark stage transitions that didn't happen
- Does not create backdated items or fabricate review records
- Does not modify any commit (merge-not-reverse constraint held)

## Verification for review

- The commit ranges above are checkable: `git log --oneline main..campaign/press-support | grep -E "^[a-f0-9]+ press (horizontal|vertical|one-sheet|:)"` yields the un-itemed set
- The conceptual parents exist: `.work/active/features/single-release-epk.md`, `.work/active/stories/story-release-epk-*.md`, `.work/active/stories/press-*.md`
- The narrative layer (retrospective + session notes) covers the arc: `.memory/sessions/press-kit-retrospective-2026-09-03.md`, `.memory/sessions/2026-09-03-press-support-arc-session-note.md`
