---
id: story-fix-creator-profile-head-title-clobber
kind: story
stage: done
tags: [content, ux-polish]
release_binding: 0.3.0
created: 2026-04-24
updated: 2026-04-24
related_decisions: []
related_designs: []
parent: null
---

Surfaced by the 0.3.0 refactor-gate scan (web/routes). The parent layout route [`routes/creators/$creatorId.tsx`](../../apps/web/src/routes/creators/$creatorId.tsx) correctly builds a dynamic `head()` from loader data — OG tags, canonical URL, JSON-LD, and a title of the form `"{creatorName} — S/NC"`. The child index route [`routes/creators/$creatorId/index.tsx:33`](../../apps/web/src/routes/creators/$creatorId/index.tsx#L33) overrides that with a static stub:

```tsx
head: () => ({ meta: [{ title: 'Creator — S/NC' }] })
```

TanStack Router merges head tags child-wins-title, so every public creator profile page currently renders the generic string `"Creator — S/NC"` in the browser tab, OG share card, and (likely) search-engine snippet. Visible 0.3.0-surface SEO regression.

## What changes

Delete the `head()` export from [`routes/creators/$creatorId/index.tsx`](../../apps/web/src/routes/creators/$creatorId/index.tsx). The parent layout's `head()` then governs the route; dynamic creator-name titles and the existing structured data take effect.

## Tasks

- [ ] Remove the `head:` option from the route definition in `routes/creators/$creatorId/index.tsx`.
- [ ] Verify no other child route in the creators tree has the same clobber pattern (`head: () =>` with a static title while the parent builds a dynamic one). Known-clean from the scan, but confirm.
- [ ] Add a one-line decision breadcrumb: TanStack Router head merging with child-wins behavior is a gotcha worth noting. If documented repeatedly, lift to `.memory/decisions/`. Skip a full decision record for this single fix.

## Verification

- Load `/creators/maya-chen` (or any active creator) in dev; confirm browser tab title is the creator's display name, not `"Creator — S/NC"`.
- Inspect page source: `<meta property="og:title" content="...">` should carry the creator name.
- Confirm no regression on the manage/admin side of the creator tree (those use a different parent and are unaffected).

## Risks

None. The parent's `head()` is already correct and handles the nested case via `loaderData`. Removing the clobbering stub restores intended behavior.
