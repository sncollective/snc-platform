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

During the later operator-driven polish rounds, 40 platform-side commits
landed without a same-commit `.work/**` update — the live-review loop
outpaced item creation. This reconciliation records the gap, computes the
exact set, and maps every commit to its conceptual grouping. It does not
fabricate retroactive process.

Early and mid-arc work generally received item records and combined
implementation/review notes, although many stories were committed directly
in their terminal state (done) rather than through separately recorded
stage transitions — the substrate does not show scope→implementing→review
commits for most items.

## The exact computation (reproducible)

```bash
# Step 1: subject-filter candidates (excludes campaign "press seed:" lane,
# convention-prefixed, and reconciliation itself):
git log --oneline main..campaign/press-support |
  grep -vE "^[a-f0-9]+ (press seed|implement|scope|review|park|debrief|docs|session|mockups|reconciliation)"
# → 48 commits

# Step 2: subtract the 8 that DID modify .work/** files:
# 71e7d0b 807804b ea4e454 b2c82e3 8eedd32 e9357de 19410e5 3ec8424
# → 40 commits that did not modify .work/**
```

These 40 are enumerated below. "Carry no item file" in the prior draft
overstated: many have conceptual coverage in existing items — the precise
statement is: **40 commits did not modify `.work/**` and received no
dedicated per-round story.**

## The 40, enumerated with conceptual groupings

**Grouping A — release EPK finish rounds** (extends
`single-release-epk` feature + `story-release-epk-template`):

| SHA | Subject (short) | Cross-scope? |
|---|---|---|
| c567be0 | inline performed-by credit | |
| b8d72ad | double rule collapse + lyric pull | |
| 0c5bd15 | Performers label + break machinery | |
| 479022e | title over abstract middle panel | |
| df09e7d | copy stack truly centers | |
| 6052d53 | catalog tag absent + body slot | |
| d14d97b | unbreakable-span wrap written-by | |
| e2f79bd | Writers label + balance | |
| fca724f | mode-dependent body slot + hero ruling | |
| 70ad6e8 | pre-save callout + title placement | |
| 1cc8bd5 | facts optical alignment | |
| a40d6f1 | fill gravity threaded + body top-anchor | cross: imgproxy gravity is global |

**Grouping B — one-sheet polish (horizontal/vertical)** (extends the
standalone stories `press-release-one-sheet-cover-art`,
`press-creator-one-sheet-fit-overflow`, `press-instagram-handles`,
`press-photography-credits`, and siblings — all `parent: null`;
"conceptual groupings," not parents):

| SHA | Subject (short) | Cross-scope? |
|---|---|---|
| 1f3b26d | scrim removal, natural floor | |
| 44c7399 | horizontal members box-aspect | |
| 8b1878a | taller hero, top-anchored | |
| 6092aac | contact inline + IG | |
| 7c37da2 | hero 300ppi, contact stack, fans/live | |
| 1c98dd6 | web banner sync, bio single-col, q:95 | cross: imgproxy quality is global |
| 2d0eba9 | web hero box aspect | cross: web surface |
| 8b82ea7 | About first-para only | |
| 95c852d | one-sheet lead spec fix | |
| 258a79c | space-between + About 11px | |
| ab0ad60 | tagline + chip + fans centering | |
| d01a675 | hydration race + fans + contact + outline | cross: script-blocking is browser-pdf infra |
| da8db49 | About/Fans divider | |
| 80182de | fans page-section + live dates pad | |
| 0740add | member windows 60px | |
| be86d8c | row sections bounded | |
| 66c490a | member spec 4:5 exact | |
| f07067a | member aspect-derived | |
| affc419 | horizontal aspect-derived | |
| 6a7b5b4 | member explicit 72x108 + fans donor | |
| e2fdef2 | title onto dark mirror | |
| dcb1ea0 | title centered | |
| 502926b | title definitely left | |
| 1cd33be | tagline names coral | |
| 5cbacfa | location direct-children scoping | |
| f3f84ce | title rebalance + EPK story accent | cross: EPK grouping A |
| 23224e4 | separator dot suppression | cross: browser-pdf infra, used by EPK |

**Grouping C — test fix mapped to existing story:**

| SHA | Subject | Maps to |
|---|---|---|
| 583596d | fix: credits test cast | `press-photography-credits` (repairs the test from f5005cd) |

The prior draft's "infrastructure/fixes" bucket is removed: the fit-check
ancestor exemption landed in 042086f (covered by
`press-instagram-handles`), script-blocking inside d01a675, q:95 inside
1c98dd6, memberDimensionMemo inside f07067a — all mapped above.

## Feature state disclosure

`single-release-epk` was advanced to `stage: done` in this revision (its
children were already done; the finish rounds are documented in the
template story's postscripts). Its review record names this
reconciliation's approval as the closing gate: the feature's done state
is CONDITIONAL on this item passing review — if this item fails, the
feature reverts to implementing. Both stage changes ship in the same
commit as this revision; the date on the feature's review record is the
revision date (2026-09-03/04 boundary in local time).

## What this item does NOT do

- Does not retroactively mark stage transitions that didn't happen
- Does not create backdated items or fabricate review records
- Does not modify any commit (merge-not-rebase held)

## Narrative count corrections

The retrospective and session note carry imprecise counts: "~130/~140
commits" (actual: 164 at session-note commit) and "76 platform stories"
(actual substrate items: 28 story files + 3 features). "76" was the
session's running count of implementation rounds (conversational), not
substrate items. The narrative files are corrected in the same commit as
this revision.
