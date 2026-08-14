---
date: 2026-08-14
session: brand-voice-system epic autopilot drain (fresh-context handoff → complete)
participants: platform agent (pi/GLM-5.2 orchestrator), org agent (mesh), operator (handoff directive)
---

# Brand-voice-system drain: full epic complete in one autopilot run

## What happened

Executed the prepared autopilot handoff: `brand-voice-system` epic drained end-to-end in one
run — 2 feature designs, 12 story implementations (7+3+2), 3 feature reviews, 1 epic review,
Phase 8 completion review + remediation. All 16 in-scope items terminal `done`; ~40 commits.

Highlights and load-bearing lessons:

- **Mid-run external gate resolution via mesh:** org delivered the public-chart palette
  minutes before the `alias-migration` story needed it (adopted verbatim as `--color-chart-*`,
  bridge deleted); org also fixed a reference bug we surfaced (dark Parent `accent-bg`
  omission, 1.62:1 — second omission-class bug their session-computed verification missed).
  Platform's contrast harness now computes the composites; parity-test shape shared to org
  for their reference lint before the stakeholder value swap.
- **Review loop earned its cost:** child-1 review found 2 real contrast blockers (consumer
  pairing gap + harness blind spot); export review found a real cascade leak (route aliases
  beating export identity — proven via Chromium probe) + an unrated public PDF route; epic
  review caught standing docs contradicting the finished system; Phase 8 caught two genuine
  gate misses (below).
- **The mockup vision gate is not optional — and it caught what code review couldn't:**
  regenerating `.mockups/design-system/tokens.css` from production passed token-name parity
  (203/203) yet broke 44 historical mocks two ways: retired alias *names* still consumed
  (dangling `var()` → invalid declarations → dark-on-dark) and light-on-`:root` inverting the
  dark-authored corpus. Three vision passes to fully diagnose + confirm restoration
  (compat-alias block + dark-default pin). A non-multimodal orchestrator literally cannot
  see this class of failure; the skill's hard rule is right.
- **"Unrelated test failures" need causal proof, not assertion:** full e2e surfaced 6
  failures post-run. Running the same specs at the pre-run commit produced *different*
  failure sets at identical code → shared-state environmental flake (2-day-old dev API
  process), parked with evidence (`e2e-shared-state-flake-2026-08-14`). Notably
  `e2e-harness-determinism` (done) did not eliminate this class.
- **Escape-hatch discipline worked:** both worker escalations (barlow-condensed variable
  package 404 on npm; TSX literals outside a CSS-scoped write boundary) were genuine
  design-reality mismatches resolved by orchestrator adjudication with verified facts
  (registry check; two-line mapping-table fix), not design flaws.

## State at close

Epic complete: neutral-spine + four-voice token architecture (light/dark/system + appearance
controller + `/settings` toggle), route-default voice scoping (RouteVoiceOutlet + portals +
SSR-first-paint), voice-themed PDF exports (explicit export identity, decoration-only creator
brand, React-PDF removed, rate-limited). Conventions published + machine-enforced (fail-closed
CSS + CSS-in-TSX no-leak grammar). Final verification: web 2,020 / api 2,037 unit / 55
integration green; real-browser typography e2e spec; mockup corpus vision-validated.

Parked: `brand-voice-user-toggle` (deferred per org/principal), `accent-bg-consumer-recipe-
alignment` (convention alignment, contrast-safe post org fix), `e2e-shared-state-flake-
2026-08-14`, `design-system-component-coverage-expansion` (pre-existing). External follow-ups:
stakeholder value swap (one pass, org signal); org wires the parity lint.
