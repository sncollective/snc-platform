---
tags: [ux-polish, design-system]
release_binding: null
created: 2026-04-20
---

# UserMenu dropdown position polish

On mobile, the user-menu dropdown (opens from the `MC` avatar in the top-right nav) appears visually detached from its trigger — floating at an offset-left position rather than tightly anchored to the avatar. Observed 2026-04-20 during `context-shell-mobile-sub-nav` review.

Root cause is Ark-UI's default Menu placement of `bottom-end` + floating-ui's automatic collision detection with the viewport right edge. The menu extends leftward from the right edge of the avatar to stay in-viewport, but the leftward shift makes it look like it's "floating in a random spot" rather than hanging from the avatar.

## Likely shape

Pick one or combine:

- **Tighter `gutter`** on `MenuRoot` positioning — reduce the default space between trigger and content.
- **Explicit `placement`** override — e.g. `bottom-end` stays but with a tuned `offset` to align the right edge more crisply with the avatar.
- **Visual cue** — an arrow/caret on the menu content pointing back at the trigger. Ark-UI supports `Menu.Arrow` — would re-anchor visually without changing position.

## Scope

Limited to [apps/web/src/components/layout/user-menu.tsx](../../apps/web/src/components/layout/user-menu.tsx) and possibly [apps/web/src/components/ui/menu.tsx](../../apps/web/src/components/ui/menu.tsx) if the positioning defaults need to flow through the wrapper.

## Verification when picked up

- [ ] UserMenu dropdown visually reads as anchored to the MC avatar at mobile portrait
- [ ] No regression on desktop
- [ ] Apply consistently to other Menu consumers (notification menu) if the same detachment is observed there
