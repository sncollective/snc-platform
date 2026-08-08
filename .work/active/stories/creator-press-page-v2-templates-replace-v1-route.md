---
id: creator-press-page-v2-templates-replace-v1-route
kind: story
stage: implementing
tags: [creators, content, ui]
parent: creator-press-page-v2-templates
depends_on: [creator-press-page-v2-templates-render-a, creator-press-page-v2-templates-render-b]
release_binding: null
gate_origin: null
created: 2026-08-07
updated: 2026-08-07
---

# Press templates — selector and v1 route replacement

## Checkpoint

Finish the public surface in place at
`apps/web/src/routes/creators/$creatorId/press.tsx`:

- exhaustive `Record<"A" | "B", ComponentType<PressTemplateProps>>` selector;
- no query override and no dual v1/v2 render;
- preserve loader/404/canonical/PDF contracts and update OG/Twitter image priority
  to delivered banner → about → first gallery;
- safely break the page out of global `.main-content` for the full-width hero
  while preserving centered 980px content;
- replace obsolete v1 CSS/photo-index/standout/release markup, leaving the manage
  editor untouched;
- verify assembled screen and letter-print behavior, including app-shell chrome.

## Acceptance evidence

Integrated route tests cover A/B dispatch, 404/error behavior, PDF URL, v2 OG
image selection, sparse images, and exact `press@s-nc.org` mailto. Web typecheck,
focused tests, desktop/mobile screenshots, and print preview pass. Source grep
finds no new `press@snc.org`, legacy `/press/photos/:index`, or individual
`@tanstack/start-*` resolution.

## Ordering

Final integration checkpoint after both explicit template renders are complete.
