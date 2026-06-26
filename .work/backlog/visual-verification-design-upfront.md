---
id: visual-verification-design-upfront
created: 2026-06-26
updated: 2026-06-26
tags: [testing, design-system, ux-polish, developer-experience]
---

# Retire "is the box in the right place / does it look good" eyeballing (design-upfront + visual regression)

The companion to the `machine-verifiable-testing` epic. That epic retires **"does it function"**
human verification (does the video play, did the queue update) via the playback/machine-signal
ladder. This item retires the **other** class of human-in-the-loop the user flagged: **"is the
box in the right place / does it look good"** visual eyeballing.

## The lever (why these two things are one item)

Design-upfront and visual-regression testing are two ends of the same lever:

- **Design phase produces the oracle.** Investing more in UI/UX design upfront yields an
  *authoritative visual spec* — mockups, design tokens, component states. That spec is what makes
  "does it look right" a **machine-answerable** question instead of a human judgment call. Without
  a spec, "looks good" is inherently subjective; with one, a render can be diffed against it.
- **Visual regression enforces the oracle.** Once there's a baseline, a snapshot diff catches "the
  box moved" / "spacing drifted" without a human looking. The e2e suite already drives real
  renders; it just doesn't assert on appearance yet.

The more design happens upfront, the less per-change visual confirmation a human owes.

## Current state (grounding, verified 2026-06-26)

- **Token surface exists and is real:** `apps/web/src/styles/global.css` defines design tokens
  consumed via `var(--token-name)`; `[design-system]` is an established tag. This is the seed of
  an oracle but not a full mockup/spec surface.
- **No `.mockups/` directory** and **no ux-ui-design plugin installed** (plugin cache has only
  agent-coordination, agentic-research, agile-workflow, peeragent). The agile-workflow `scope`
  skill has *conditional* hooks for a `ux-ui-design` plugin (`/ux-ui-design:palette`,
  `:flows`) — i.e. there's a designed integration seam if we adopt that plugin.
- **Visual regression today is explicitly MANUAL** — e.g. the 0.3.0
  `design-system-foundation-token-restructuring` feature carries a literal
  "Visual Regression: Manual Verification" section. That is precisely the eyeball to retire.
- **No Playwright visual-snapshot capability** (`toHaveScreenshot` / `toMatchSnapshot`) is wired
  into the e2e suite — visual regression is greenfield there.

## Two things to evaluate at scope time

1. **The ux-ui-design plugin (nklisch/skills system) — compatibility check.** Evaluate whether
   it's compatible with our design surface: does its palette/tokens model (`.mockups/design-system/
   tokens.css` per the scope skill's references) interoperate with our existing `global.css`
   `var(--token-name)` tokens, or would it want to own/replace them? Does its flows/mockup output
   fit a TanStack Start + ark-ui component surface? The seam exists in agile-workflow already; the
   open question is surface compatibility, not whether the hook fires.

2. **Visual-regression strategy — deliberate or it backfires.** Snapshots are notoriously flaky
   (font AA, sub-pixel, dynamic content). Done naively they *add* a babysitting burden instead of
   removing one. A real strategy needs: viewport/font pinning (the `e2e-harness-determinism`
   feature's clock/seed/determinism work is the natural foundation), dynamic-region masking, and a
   baseline-update workflow. The L4 vision capability (`e2e-agent-vision-pixel-inspection`,
   re-scoped to triage-only) is also useful here for net-new screens with no baseline yet:
   "agent compares render to mockup."

## Why parked, not scoped now

Depends on the `machine-verifiable-testing` harness foundation (determinism/viewport pinning)
being designed first, and on a plugin-compatibility evaluation that's its own grounding pass.
Scope as its own arc (likely an epic — design-surface investment + visual-regression harness are
multi-feature) after the harness feature's design pass clarifies the determinism substrate it
builds on.

## Provenance

User direction, 2026-06-26: "if we spend more time in the UI/UX design phase I won't have to
verify as much 'is the box in the right place / does it look good' type items." Surfaced
alongside the `machine-verifiable-testing` epic (functional-verification half of the same
minimize-HITL goal).
