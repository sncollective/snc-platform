---
id: story-notification-preferences-ui-nav-link
kind: story
stage: implementing
tags: [community, content]
release_binding: null
created: 2026-04-18
updated: 2026-04-23
related_decisions: [platform-0010]
related_designs: []
parent: null
---

Settings page at `/settings/notifications` exists and works but has no nav link hookup. Page was built as part of the `notifications` feature but the nav link was deferred. Discoverability gap — users have no path to reach their preferences.

## Tasks

- [ ] Identify the correct nav surface per `platform-0010-nav-context-shell-pattern` (likely the settings sub-nav or user menu).
- [ ] Add the nav link entry pointing at `/settings/notifications`.
- [ ] Verify the link renders and routes correctly in both authenticated and unauthenticated states (auth-gated if the page itself is).

## Risks

None meaningful — additive nav entry, no behavior change to the existing page.
