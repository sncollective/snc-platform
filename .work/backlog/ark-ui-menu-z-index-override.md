---
tags: [design-system, developer-experience]
release_binding: null
created: 2026-04-20
---

# Ark-UI Menu z-index override — replace `!important` with a cleaner fix

During the `context-shell-mobile-sub-nav` review (2026-04-20), a z-order collision between the new sticky chip bar and the user-menu dropdown surfaced a deeper issue with how Ark-UI's Menu positioner handles z-index.

## What we learned

Ark-UI's [Menu.Positioner](../../apps/web/src/components/ui/menu.tsx) applies its own inline style:

```html
style="... z-index: var(--z-index); --z-index: auto;"
```

- The inline `z-index: var(--z-index)` wins the cascade over any class-based `z-index` (inline > class specificity).
- The inline `--z-index: auto` also wins over any class-based `--z-index` (same reason), so we can't "replace the value of the variable" from CSS.
- Net effect: the positioner ends up with `z-index: auto` regardless of what we set on its class, unless we use `!important` on the direct `z-index` property to supersede the inline declaration.

Current workaround in [apps/web/src/components/ui/menu.module.css](../../apps/web/src/components/ui/menu.module.css):

```css
.positioner {
  z-index: var(--z-dropdown) !important;
}
```

This is tagged with an inline comment explaining why `!important` is here. But `!important` is a code smell and a platform-design skill probably flags it.

## Why it matters

Affects *all* Menu dropdowns in the app (user menu, notification menu, any future Menu consumer). Until the chip bar landed there was no sticky element competing at z-index, so the silent `z-index: auto` worked by DOM-order luck. Now that sticky nav patterns exist (chip bar, likely others ahead), other Menu consumers would exhibit the same stacking bug if we don't keep the override.

Likely applies to Ark-UI Popover, Combobox, Select, Tooltip — any component that uses a positioner with the same inline pattern. [select.module.css](../../apps/web/src/components/ui/select.module.css) and similar may need the same treatment if/when they surface the same bug.

## Possible better fixes to investigate

- **Ark-UI prop for z-index** — does Ark-UI's Menu.Root accept a `positioning` option that lets us pass z-index explicitly? If yes, use it instead of CSS override.
- **CSS layer ordering** — put the component styles in a CSS cascade layer after Ark's injected inline. Whether this beats `style=""` inline is browser-specific; worth testing.
- **Forward style prop** — wrap MenuContent and pass `style={{ '--z-index': ... }}` as a prop, attempting to set the inline custom property from the React side. Check if Ark's inline spread preserves user-provided `style` props or clobbers them.
- **Upstream** — file an issue / PR with Ark-UI to expose a cleaner z-index customization path. Check if one already exists.
- **Broader audit** — check all `z-index: var(--z-*)` uses against elevation.css's own self-aware comment about the scale being misaligned with reality ("user-menu/notification dropdowns (200) use raw values because their relative stacking doesn't map onto the token semantics cleanly"). A proper pass on the z-token scale may make `!important` unnecessary.

## Verification when picked up

- [ ] `.positioner` in menu.module.css achieves correct z-ordering WITHOUT `!important`
- [ ] Same treatment applied to other Ark-based positioners if they share the inline-style pattern (popover, combobox, select)
- [ ] All existing dropdowns still render correctly above sticky elements (chip bar, etc.)
- [ ] Document the resolution approach so future component additions use it correctly
