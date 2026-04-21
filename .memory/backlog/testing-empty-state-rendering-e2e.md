---
tags: [testing, ux-polish]
release_binding: null
created: 2026-04-20
---

# Testing: empty-state rendering e2e coverage

Verify golden-path e2e assertions still pass against the new icon+text empty-state layouts on /feed, /creators, /governance/projects, /admin/creators, and /admin. The empty-state markup changed: `apps/web/src/styles/listing-page.module.css` added an `.empty` class, and pages now wrap messages in `<div>…<p>…</p></div>` instead of bare `<p>` elements. Existing assertions targeting bare `<p>` text may fail against the new structure.

Forwarded from feature/release-0.2.5 (2026-04-04).
