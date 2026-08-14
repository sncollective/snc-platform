---
date: 2026-08-14
session: brand-token-architecture scoping → design → review loop
participants: platform agent (pi), org agent (mesh), operator
---

# Brand token architecture: org handoff → epic → design → adversarial review → rework

## What happened

Org delivered the brand-architecture reference (neutral spine + 4 per-voice accents, light
+ dark, route-scoped). Platform audited (96 distinct hex/rgb values → later corrected to
**133 expressions / 338 occurrences** across all color syntaxes; 68 ad-hoc leaks; dark-only,
no theme/route mechanism; fonts = Inter+Georgia via Google), categorized every color use
(scratchpad artifact), and raised 5 reference gaps to org — all adjudicated: STATE shared /
IDENTITY breathes; data-viz audience-split (internal ours, public brand-constrained);
on-media from org + on-status/on-badge ours; links alias to accent (provisional);
accent-subtle oversight fixed.

Restructured `brand-token-architecture` into the **`brand-voice-system` epic**: child 1
token foundation (7 stories spawned, implementing), child 2 route-scoping (designed —
RouteVoiceOutlet, `display:contents` boundary, portal handling), child 4 export-theming
(undesigned). Child 3 (user-selectable voice toggle) **deferred to backlog** per
org/principal — voices are identity-bearing; user-swappable breaks the semantic; only
Parent-fallback stays architecturally supported.

Child 1 designed via subagent (mapping table, conventions, theming/route mechanism,
Fontsource fonts, token-file structure, refactor discovery) → **adversarial review** found
4 blockers + 7 majors → adjudicated (operator overruled B2 severity: single-release
shipping, no user-facing intermediate states) → full rework folded and verified. Org fixed
the value-level findings in place (dark Parent hover bug ~1.28:1→6.25:1; failing AA pairs
retuned; **dark status bgs now opaque/host-independent**; hover/disabled/tint composites in
the matrix contract; links underline-by-default approved).

Key learnings worth keeping:
- The single-release fact changes review severity calculus — "unsafe intermediate states"
  only matter for user-facing deploys; keep the kernel (dark pin), drop the re-slice.
- Org's reference had real bugs an adversarial WCAG pass catches — placeholder values still
  need computed verification, and translucent `-bg` tints are host-dependent (now opaque).
- CSS gotcha: setting `--font-body` on a scope does NOT recompute a `font-family` already
  resolved on `<body>` — route scopes must set `font-family: var(--font-body)` explicitly
  (now a contract rule in `resolution.css`).
- PDF-preview colors are output semantics (fixed `--preview-*` roles), not mode-aware spine.
- Inventory grammar matters: hex/rgb-only scanning missed HSL, color functions, and 141
  named-color occurrences.

## State at close

Epic drain-ready: token-restructure READY, 6 stories chained, child 2 designed, child 4
pending design. External gates (non-blocking at start): org public-chart palette gates only
the alias-migration bridge-token gate; stakeholder values land as a final swap. Autopilot
handoff block in the epic carries the operator directive (fresh-context drain may design
anything without open operator questions; child 4's voice-selection is already adjudicated).
Parked: `brand-voice-user-toggle` (deferred), `design-system-component-coverage-expansion`
(component layer evolution, seeded by child 1's refactor discovery).
