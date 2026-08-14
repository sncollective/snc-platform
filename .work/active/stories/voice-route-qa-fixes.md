---
id: voice-route-qa-fixes
kind: story
stage: implementing
tags: [design-system, streaming, creators]
parent: null
depends_on: []
release_binding: null
gate_origin: org Thread-3 QA (visual + pixel sampling of voiced routes), 2026-08-14
created: 2026-08-14
updated: 2026-08-14
---

# Voice-route QA fixes (org Thread-3 findings f1–f4)

## Findings (all accepted; f1–f3 org-confirmed, f4 scope gap)

- **f1 — /live sparse threading** (both modes): TV accent confined to chat tab underline +
  Sign-in. Thread into ≥2 shell-content anchors: channel label + scheduled-status treatment.
- **f2 — LIVE chip wrong red**: samples `#DC2626` (stock-red leftover from the old palette's
  archived row) instead of the TV signature `--voice-tv-accent2` (#FF4081). The LIVE chip IS
  TV's signature surface — consume the token.
- **f3 — global active-nav underline stays neutral on voiced routes**: violates the LOCKED
  STATE/IDENTITY recipe (nav-active = IDENTITY, breathes). Root cause: nav lives in the
  persistent shell OUTSIDE the RouteVoiceOutlet subtree, so CSS route-scoping can't reach it.
  Fix shape (org-endorsed): keep the DOM boundary; the NavBar consumes the pure resolver
  (`resolveRouteVoice(pathname)`) to accent the active link — no principal question, the
  locked rule adjudicates.
- **f4 — signature chips missing**: `24·96` on /studio, `A1` on press. Not deferred — never
  scoped. Tokens exist (`--voice-*-accent2`), the convention sanctions raw voice use ONLY in
  chips, and the checker allowlist already names `components/brand/signature-chip.module.css`
  as the sanctioned owner (module doesn't exist yet — build it). LIVE chip doubles as TV's.

## Acceptance

- /live: ≥2 new tv-accent anchors (channel label, scheduled status) + LIVE chip on
  `--voice-tv-accent2` in both modes.
- Active nav link on a voiced route carries the route's accent; on parent routes unchanged
  steel. Resolver-driven (no CSS scope change at the shell).
- `SignatureChip` component (sanctioned `accent2` owner) renders `24·96` on /studio and `A1`
  on the public press page; contrast-verified in both modes.
- Web suite + build green; checker entry exercised (sanctioned chip file consumes only the
  exact accent2 expressions).
- f5 (press pills neutral) explicitly no-action (restraint is correct).
