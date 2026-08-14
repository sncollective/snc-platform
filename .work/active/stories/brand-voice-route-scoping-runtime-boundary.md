---
id: brand-voice-route-scoping-runtime-boundary
kind: story
stage: done
tags: [design-system]
parent: brand-voice-route-scoping
depends_on: [brand-token-architecture]
release_binding: null
gate_origin: null
created: 2026-08-14
updated: 2026-08-15
---

# Brand voice — runtime route boundary and resolver

## Brief

Implement the runtime half of route-default voice scoping described in the parent feature.
Add a pure pathname resolver and a `RouteVoiceOutlet` boundary backed by a small route-voice
context. The boundary wraps only the root `Outlet` with a transparent `display: contents`
container and emits the resolved `data-route` identity (`parent`, `studio`, `tv`, or
`records`). It must not add a route layout, mutate `<html>`, or define CSS aliases.

## Acceptance

- The pure resolver normalizes trailing slashes only, maps exactly `/studio` to `studio`,
  exactly `/live` to `tv`, and the `/creators/<creatorId>/press` segment plus descendants
  to `records`; `/press-kit`, manage descendants, admin, playout, and all other paths map
  to `parent`.
- `RouteVoiceOutlet` reads pathname with the render-time `useRouterState` selector, emits
  `data-route` before paint, and renders the existing `Outlet` without an additional layout
  box or route-specific wrapper.
- The route context exposes the route identity and keeps the future `routeDefault` /
  `effectiveVoice` shape without implementing a preference, storage, or
  `data-effective-voice` attribute. A `useRouteVoiceAttributes()` helper is available to
  the portal story without re-solving the pathname.
- The boundary is deterministic for SSR and hydration: no `useEffect`, `window`, or
  post-mount DOM mutation participates in route resolution. Client navigation updates the
  route identity in the same router render.
- The persistent `GlobalPlayer`, live/footer shell, navigation, bottom bar, and chat portal
  target remain outside the boundary. Parent fallback remains explicit as
  `data-route="parent"` for observability.

## Constraints

`brand-token-architecture-route-scoping-contract` owns the CSS alias blocks and their
computed-style assertions. This story owns only runtime plumbing and its resolver/context
surface; it must not implement CSS alias declarations or raw `--voice-*` usage.

## Implementation notes

- Added a pure trailing-slash-normalizing pathname resolver and typed route-voice context with
  both `routeDefault` and the reserved `effectiveVoice` field. The portal attribute helper reads
  context rather than re-solving the route.
- Added an SSR-renderable transparent scope and a router-aware `RouteVoiceOutlet`; resolution is
  render-time through `useRouterState`, with no client-only branch or effect.
- Replaced only the root `Outlet` with `RouteVoiceOutlet`. The player, footer, navigation, bottom
  bar, and chat portal target remain siblings outside the voiced inheritance boundary.
- Direct-read implementation by one feature owner; focused resolver and server-render tests plus
  the full web suite passed (`2004` tests).
