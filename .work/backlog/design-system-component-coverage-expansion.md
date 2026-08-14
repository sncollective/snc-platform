---
id: design-system-component-coverage-expansion
tags: [design-system, refactor]
release_binding: null
created: 2026-08-13
---

# Expand components/ui coverage to centralize token consumption

The cleaner end-state for the design system: theming flows through the `components/ui`
layer (one component API consuming tokens), not through N feature CSS modules. This is the
"crystallize the tokens→component-library boundary" option explored alongside the
`brand-voice-system` epic (2026-08-13).

## Why it's the cleaner system

A `components/ui/` wrapper layer ALREADY EXISTS (button, dialog, menu, popover, select,
tabs, field, checkbox, etc. — each a `.tsx` + `.module.css` pair wrapping a headless Ark UI
primitive) and already consumes tokens. The 96-color drift surfaced in the brand-token
audit is largely a symptom of the **long tail of feature CSS modules bypassing that layer**
(`manage-press`, `media-picker`, `chat-panel`, `playout`, etc. roll their own styling
instead of consuming shared themed components). The leak problem is substantially a
"not-using-the-component-layer" problem.

Expanding coverage centralizes token consumption: modes/voices flow through one component
API, and drift can't re-accumulate where there's no ad-hoc module. Because the scaffolding
exists, this is an **evolution** (expand coverage + standardize the wrapper pattern), not a
revolution (build from scratch).

## Relationship to brand-voice-system

- **Downstream, not alternative.** Needs the disciplined token system first — can't expand
  the component layer on top of a placeholder-value, unvalidated token model.
- **(a) seeds (c).** The brand-token-architecture refactor-discovery will flag the
  component-extraction candidates (feature modules whose ad-hoc styling should become a
  `components/ui/` component — e.g. media-picker's repeated selection styling). Those flags
  feed this work.
- **Trigger:** pursue once the token system lands + stakeholder values finalize + the
  spine/voice model is validated in production.

## Open questions for whenever this is picked up

- Standardize the wrapper styling vehicle: keep per-component CSS modules, or move wrappers
  to a centralized token→style mechanism (e.g. a theme object / slots)?
- How aggressive on coverage — absorb the whole long tail, or just the high-traffic /
  high-drift surfaces (media-picker, chat, press, playout)?
- Does this become "design-system phase 7" in the `ui-ux-system-plan.md` roadmap lineage?
