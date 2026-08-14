---
id: brand-voice-user-toggle
tags: [design-system]
release_binding: null
created: 2026-08-13
---

# Brand voice — user-selectable voice toggle (DEFERRED)

**Deferred 2026-08-13 per org/principal** — off the table for MVP. Voices are identity-
bearing (they tell you which unit you're in); user-swappable breaks the semantic. Revisit
after the `brand-voice-system` architecture is established.

Was child 3 of `brand-voice-system`; moved here from `.work/active/features/`.

## The deferred idea

A settings appearance toggle letting a user pick a voice platform-wide
(auto / parent / studio / tv / records), co-located with the light/dark/system mode toggle.
Precedence: user-explicit > route-default.

## What is NOT deferred (stays in MVP)

- The **light/dark/system mode toggle** stays — it lives in `brand-token-architecture`
  (child 1), not here. Mode (polarity) is not voice (identity).
- **Parent-fallback** is architecturally supported already: route-scoping defaults to
  Parent when no `[data-route]` is active.

## Revisit condition

After the route-scoped voice system is established + validated in production. The only
user-facing toggle the principal would entertain is a **"neutral / Parent mode"** (revert to
neutral branding), NOT any-voice-pickable. Don't architect it out, but don't build it now.
