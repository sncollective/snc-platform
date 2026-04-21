---
tags: [ux-polish, design-system]
release_binding: null
created: 2026-04-20
---

# Creators list view-mode hydration flash

On `/creators` with `localStorage[snc-creators-view-mode] = "list"`, a hard refresh shows the grid view briefly before the list view takes over. The grid frame renders, then the DOM reflows into list rows once client hydration reads localStorage.

Root cause: `getInitialViewMode()` at [routes/creators/index.tsx:53-57](../../apps/web/src/routes/creators/index.tsx#L53-L57) returns `"grid"` on the server (no `window`) and reads localStorage only on the client. SSR renders grid; hydration triggers a re-render to list. Classic client-only-preference hydration flash.

The Manage button visibility is unrelated — that's `creator.canManage` (admin/owner-bit) and only appears to authorized users. Hydration flash happens for anyone who previously toggled the view to "list".

## Likely shapes

- **Cookie-backed preference** — write the view mode to a cookie alongside localStorage; SSR reads the cookie, picks the right mode for initial render. Most robust fix.
- **Hide the content until hydrated** — render a neutral skeleton or spinner during SSR and only paint the list/grid after hydration. Eliminates flash but adds blank-state flicker.
- **CSS-only reveal** — render both trees, toggle via a body-level class set by a synchronous inline script that reads localStorage before hydration. Fast, but pollutes the DOM with both trees.

Cookie approach scales to other client preferences (theme, density) if we pick it up as a pattern.

## Verification when picked up

- [ ] Reload `/creators` with `list` preference — no grid → list flash
- [ ] Reload with `grid` preference — no flash, grid stays grid
- [ ] Works for first-time visitors (default to grid, no flash since SSR default matches client default)
- [ ] No Lighthouse CLS regression
