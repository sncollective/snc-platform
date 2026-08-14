---
id: brand-voice-route-scoping
kind: feature
stage: done
tags: [design-system]
parent: brand-voice-system
depends_on: [brand-token-architecture]
release_binding: null
gate_origin: null
created: 2026-08-13
updated: 2026-08-15
---

# Brand voice — route-default scoping

## Brief

Implement the route-scoping mechanism so each route resolves to its default voice. Generic
components consume the route-resolved tokens (`--color-accent`, `--color-on-accent`,
`--color-accent-hover`, `--color-accent-bg`, `--color-accent-subtle`, `--radius`,
`--font-body`, `--font-display`); direct `--voice-*` use is sanctioned only for signature
chips (MEMBER-OWNED / 24·96 / ●LIVE / A1). This is the "auto" mechanism (a user-selectable voice toggle is deferred — see epic).

## Scope

- `data-route` (or equivalent) attribute plumbing on route containers (TanStack file routes;
  per-leaf-route — the `/manage` shell is Parent, only its public-facing leaves breathe).
- Voice → route map (locked, see epic): `/studio` → Studio; `/live` → TV; public press kit
  (`/creators/$creatorId/press/`) → Records; everything else → Parent.
- Route-scoping CSS blocks per the reference pattern
  (`[data-route="studio"] { --color-accent: var(--voice-studio-accent); ... }`).
- Records nuance: the warm palette currently on the *internal* `/manage/press` +
  `/manage/library` screens is misplaced (those are Parent); it migrates to neutrals in
  child 1. Records applies only to the public press kit.

## Simplification opportunity

- Once route-scoping resolves `--color-accent` everywhere, no component should hardcode a
  voice accent directly — retire the implicit voice-less accent usage.

## Depends on

`brand-token-architecture` — voice accent tokens + the route-resolved generic tokens must
exist first.

<!-- Design accumulates via feature-design / refactor-design once the foundation lands. -->

## Design — Runtime data-route plumbing

### Chosen boundary

Use one transparent `RouteVoiceOutlet` boundary at the root `Outlet`, backed by a small
route-voice context. Do not add a voice layout route, mutate `<html>`, or require every
leaf route to hand-maintain the route map. The boundary will:

1. read the current pathname with `useRouterState({ select: (state) => state.location.pathname })`;
2. resolve the pathname through a pure, shared route table; and
3. provide the resolved route value to descendants while rendering a neutral
   `<div data-route="...">` with `display: contents` around the `Outlet`.

The `display: contents` boundary is deliberate: it gives the CSS contract a real
inheritance boundary without inserting a layout box between the existing outlet column
and its leaf content. It should emit `data-route="parent"` explicitly for observability,
even though Parent is also the `:root` fallback in child 1's contract. The resolver is:

| normalized pathname | emitted `data-route` |
|---|---|
| exactly `/studio` | `studio` |
| exactly `/live` | `tv` |
| `/creators/<creatorId>/press` or any descendant below it | `records` |
| every other path, including `/creators/<creatorId>/manage/**` | `parent` |

Normalize only trailing slashes before matching. The press rule must match a path-segment
boundary, not a loose string prefix, so `/creators/x/press-kit` cannot become Records.
The public press rule covers both the index route and the release one-sheet route:
`routes/creators/$creatorId/press.tsx:56-79` and
`routes/creators/$creatorId/press/releases/$releaseSlug.tsx:67-127`. It intentionally does
not match the internal manage tree; that tree is rendered through the `ContextShell`
Outlet at `routes/creators/$creatorId/manage.tsx:120-127` and remains Parent.

### Exact placement in the root shell

Split the current outlet-column block so only the `Outlet` is a child of the route
boundary. The resulting ownership is:

- `GlobalPlayer` remains outside it (`routes/__root.tsx:120-123`), so the persistent
  player does not inherit TV or another leaf voice.
- `RouteVoiceOutlet` wraps the `Outlet` at `routes/__root.tsx:122-124`.
- The live-layout `Footer` remains outside it (`routes/__root.tsx:123-125`), as do the
  root `NavBar`, bottom tab bar, and non-live footer.
- The chat portal target remains outside it (`routes/__root.tsx:126-132`); the target is
  shell infrastructure, not a voiced leaf container.

This central boundary also covers route components whose root is a fragment or whose
visible result is a route-level error/not-found component. No special wrapper is needed
in `studio.tsx` (whose normal root is at `routes/studio.tsx:28-43`) or in the press and
release leaves. It follows TanStack Start's file-route composition: the root route owns
the persistent shell, while the active file route is rendered at the `Outlet` boundary
(`routes/__root.tsx:103-125`; the creator layout also passes through an `Outlet` at
`routes/creators/$creatorId.tsx:48-52`).

The route-voice context is not the CSS contract and does not carry token values. It
carries only the route identity (`parent | studio | tv | records`) and exposes a small
`useRouteVoice()`/attribute helper for portals. Components continue to consume child 1's
route-resolved generic aliases; no component branches on the route name.

### SSR and navigation behavior

The resolver must be render-time and deterministic, with no `useEffect`, `window`, or
post-hydration DOM mutation. TanStack Router already exposes pathname state through the
same `useRouterState` pattern used by `components/layout/context-shell.tsx:64-71`.
Therefore the server render for `/studio`, `/live`, or a public press URL emits the
correct `data-route` before the stylesheet paints, and hydration sees the same pathname
and attribute. A client navigation updates the boundary and the leaf in the same router
render; it must never briefly fall back to Parent merely because a component has not yet
mounted. The pure resolver and the boundary should be kept separate enough that the
resolver can be tested without booting the full shell.

**Font-family note (child 1 contract):** overriding `--font-body` on a scope does not
recompute a `font-family` already resolved on `<body>` — plain route text would stay in the
Parent face. Child 1's `resolution.css` therefore adds
`[data-route] { font-family: var(--font-body); }` (headings already resolve
`--font-display` per-element), so this boundary's subtree renders in the voice face without
the boundary setting inline styles.

## Design — Portal & nesting edge cases

A React portal preserves React context but not DOM ancestry. The app has two portal
families that therefore need explicit handling:

1. **Shared Ark UI portals.** `SelectContent`, `DialogBackdrop`/`DialogContent`,
   `Tooltip`, `PopoverContent`, and `MenuContent` all use `@ark-ui/react/portal`:
   `components/ui/select.tsx:37-44`, `components/ui/dialog.tsx:22-40`,
   `components/ui/tooltip.tsx:26-34`, `components/ui/popover.tsx:16-27`, and
   `components/ui/menu.tsx:16-24`. Keep the existing portal target and positioning
   behavior, but apply the current context's `data-route` directly to each portal's
   outermost styled/positioned element (the `Positioner`, or the backdrop where there
   is no positioner). That makes the route aliases inherit through the portal content
   without adding an unstyled wrapper that could affect positioning. A shared
   `useRouteVoiceAttributes()` helper prevents the five primitives from each re-solving
   the map.
2. **The live chat portal.** `routes/live.tsx:285-376` uses `createPortal` to place
   `#live-chat-panel` into the `chatPortalRef` target supplied by the root shell
   (`routes/__root.tsx:101,126-132`). Leave that target attribute-free. Add
   `data-route="tv"` to the portaled `#live-chat-panel` root, obtained from the route
   context, so chat controls inherit TV tokens while the surrounding shell still stays
   Parent.

Portals opened by shell-owned UI (for example, a menu in the persistent navigation)
remain Parent because the route context's default is Parent. A portal opened from a
voiced leaf receives that leaf's route identity even though its DOM node is under
`body` or the shell target. Nested portals inherit the React context and repeat the
attribute at each new DOM root. If a future portal API accepts an explicit container,
that is still not a reason to put `data-route` on `body` or on the persistent shell.

The server-rendered leaf boundary remains the first-paint guarantee. Most overlays are
closed during SSR; when an overlay is rendered server-side, the same direct attribute
must be present on its portal root rather than being attached in an effect.

## Design — Future voice-override seam

The MVP context has two conceptual fields even though only one behavior is implemented:
`routeDefault` (immutable route identity) and `effectiveVoice` (currently equal to
`routeDefault`). The route boundary must always retain `data-route` as the route identity.
A future user preference may add `data-effective-voice="parent|studio|tv|records"` on the
same leaf boundary and on any portaled roots, without changing or removing
`data-route`. The value `parent` can then represent a deliberate neutral override while
`data-route="studio"` remains inspectable as the route's automatic identity.

The future provider should sit above the `Outlet` boundary so a preference change updates
all leaf descendants and portal attributes. It must not write style properties directly
or mutate the route attribute. Child 1's CSS resolution layer will own the precedence:
its later effective-voice alias layer should override route-default aliases, while the
shared token spine remains unchanged. This pass does not add the preference, storage,
toggle, or effective-voice attribute; it only keeps the context and portal helper shaped
so that adding it does not require reworking route components.

**Coordination gap for child 1:** the current CSS brief reserves `data-effective-voice` as a
future seam (`brand-token-architecture.md:505-508`), but it does not yet lock the selector
shape or precedence behavior for portal roots. Document that exact alias layer before the
deferred toggle is designed. This is not an MVP blocker: child 2 only emits `data-route`,
and child 1's Parent `:root` fallback intentionally needs no `[data-route="parent"]` CSS
block.

## Design — Verification

Child 1's `brand-token-architecture-route-scoping-contract` story owns the CSS selector
and alias-resolution assertions (`brand-token-architecture.md:455-503`), while the reserved
future seam is documented at `brand-token-architecture.md:505-508`. Child 2
supplies the runtime boundary, route table, and portal fixtures that feed that contract.
The verification slice is:

- **Resolver table test:** assert `/studio` → `studio`, `/live` → `tv`, a press-kit URL
  and `/creators/c1/press/releases/a1` → `records`, `/creators/c1/manage/press` and
  `/creators/c1/manage/library` → `parent`, plus representative root/admin/playout
  paths → `parent`. Include trailing-slash normalization and a near-prefix negative case.
- **SSR boundary test:** render the boundary with representative paths using the
  server renderer and assert the returned HTML already contains the expected
  `data-route`; assert no client-only effect or `window` branch is needed. This is the
  first-paint check, not merely a post-mount DOM assertion.
- **Shell containment test:** render a shell fixture with a marker for the outlet and
  markers for `GlobalPlayer`, `Footer`, and the chat target. Assert the route attribute
  is on the transparent outlet boundary and is absent from the persistent-shell markers.
  This guards the leaf-container-not-`<html>` decision from
  `routes/__root.tsx:103-132`.
- **Nested-route fixtures:** verify that both public press leaves resolve Records and
  that the creator manage layout's nested leaves remain Parent. The fixture should also
  cover the studio feature-disabled/Coming Soon render, because the boundary is at the
  root outlet rather than only around the normal studio markup.
- **Portal fixtures:** from a TV boundary, render an Ark-style positioned portal and the
  live chat portal, then assert the portal roots carry `data-route="tv"` while the
  portal target does not. Render a shell-originated portal and assert Parent. This is
  the runtime half of the CSS contract; child 1 can reuse the same portal roots for
  alias-computed-style assertions.
- **Navigation update test:** change the pathname from Studio to Parent/Records and
  assert the boundary changes atomically, with no stale old route attribute left behind.

No child-2 test should assert the raw `--voice-*` declarations themselves; those are
owned by child 1. The route fixtures should instead prove that the runtime places the
attributes on the elements whose inherited aliases child 1 tests.

## Implementation Order

1. **Runtime boundary** — after `brand-token-architecture-route-scoping-contract`, implement
   the pure pathname resolver, route-voice context, and `RouteVoiceOutlet` around only the
   root `Outlet`. Keep the boundary transparent (`display: contents`), render-time, and
   Parent-fallback-safe; do not add CSS declarations or a route-specific layout route.
2. **Portal propagation** — after the boundary exists, add the shared route-attribute helper
   to the five Ark UI portal primitives and add the resolved route attribute to the live
   chat panel root. Leave the root chat portal target and persistent shell markers
   attribute-free; shell-owned portals therefore remain Parent.
3. **Verification** — run the resolver, SSR, shell-containment, nested-route, portal, and
   navigation-update fixtures as one runtime contract. Assertions cover placement and
   inheritance inputs only; child 1 owns CSS alias declarations and computed-style
   assertions. No new UI surface is introduced, so the mockup phase is intentionally skipped.

The resulting dependency chain is: child-1 completion (including
`brand-token-architecture-route-scoping-contract`) →
`brand-voice-route-scoping-runtime-boundary` → `brand-voice-route-scoping-portal-attributes`
→ `brand-voice-route-scoping-verification`.

## Implementation summary

- Landed the pure route table, typed route-default/effective-voice context, transparent root
  outlet boundary, and explicit Parent fallback without touching token CSS or persistent shell
  ownership.
- Propagated the context identity across all shared Ark UI portal primitives and the live chat
  React portal while leaving portal targets and shell infrastructure unvoiced.
- Added the complete runtime contract: resolver/nested-route matrix, server-rendered first-paint
  attributes, root-shell containment, feature-disabled Studio, nested and shell-owned portals,
  live chat target isolation, and atomic navigation updates.
- Execution stayed with one feature-owning worker across the ordered story checkpoints because the
  context, portal consumers, and integration fixtures form one cohesive ownership band.

## Integrated verification

- `bun run --filter @snc/web test` — passed: 195 files, 2014 tests.
- `bun run --filter @snc/web build` — passed (known third-party `use client` warnings only).
- `bun run --filter @snc/web typecheck` — passed after route generation.

## Review — standard pass (2026-08-14)

**Verdict: ready** (cross-model fresh-context: host GLM-5.2 → GPT-5.6 Sol). No blockers, no
important findings, no nits. Reviewer ran adversarial resolver checks (exact-route
descendants, near-prefixes like `press-kit`, malformed creator paths, manage trees,
trailing slashes — all resolved correctly), verified boundary containment, portal
propagation, CSS-contract integration (no route-name branching, no raw `--voice-*` component
consumption), and 77/77 focused contract tests. Security/persistence lenses skipped as
inapplicable (no auth/data/network surface); no new visual surface. Standard closure:
one pass, approved, `review -> done`.
