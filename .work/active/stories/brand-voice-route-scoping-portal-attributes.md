---
id: brand-voice-route-scoping-portal-attributes
kind: story
stage: done
tags: [design-system]
parent: brand-voice-route-scoping
depends_on: [brand-voice-route-scoping-runtime-boundary]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-15
---

# Brand voice — portal route-attribute propagation

## Brief

Propagate the route identity across DOM portals without moving the portal target or
re-solving the route in each primitive. Consume the route context/helper from
`brand-voice-route-scoping-runtime-boundary` in the five shared Ark UI primitives and in
live chat.

## Acceptance

- `SelectContent`, `DialogBackdrop`/`DialogContent`, `Tooltip`, `PopoverContent`, and
  `MenuContent` attach the current `data-route` to their outermost styled/positioned DOM
  element: the `Positioner` where present, or the backdrop where no positioner exists.
  Existing Ark Portal targets and positioning behavior remain unchanged.
- The live `#live-chat-panel` root receives the current route identity (TV on `/live`),
  while the root shell's `chatPortalRef` target remains attribute-free.
- Portals opened from a voiced leaf inherit that leaf's route identity through React
  context; shell-owned portals remain Parent. Nested portal roots repeat the attribute
  rather than relying on DOM ancestry.
- Attribute assignment is render-time and SSR-safe; it does not depend on an effect or
  client-only DOM mutation.
- No `data-route` is added to `<html>`, `body`, the persistent shell, or the chat target,
  and no `data-effective-voice` implementation or CSS alias declaration is added.

## Constraints

The child-1 `brand-token-architecture-route-scoping-contract` story owns CSS aliases and
computed-style assertions. This story owns only portal attribute plumbing and must not
implement CSS alias blocks or raw `--voice-*` declarations.

## Implementation notes

- Applied the shared context-derived route attribute to Select, Dialog, Tooltip, Popover, and
  Menu portal roots at their existing Ark UI positioner/backdrop elements; no positioning
  wrapper or portal target changed.
- Applied the same render-time helper to the portaled live chat panel. A DOM portal fixture
  verifies TV identity crosses the React portal while the shell target remains attribute-free.
- Added focused primitive fixtures covering all six Ark portal roots and the explicit Parent
  fallback for shell-originated portals.
- Focused portal/live tests passed (`29` tests), followed by the full web suite (`2007` tests).
