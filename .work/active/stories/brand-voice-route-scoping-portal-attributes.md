---
id: brand-voice-route-scoping-portal-attributes
kind: story
stage: implementing
tags: [design-system]
parent: brand-voice-route-scoping
depends_on: [brand-voice-route-scoping-runtime-boundary]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-14
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
