---
tags: [testing, community]
release_binding: null
created: 2026-04-21
---

# Testing: creator follow/unfollow e2e coverage

Verify golden-path e2e coverage for the follow button toggle on creator header: follow state renders correctly on page load, toggling follow persists the new state, and unfollow reverts the state.

Relevant files: `apps/api/src/routes/follow.routes.ts`, `apps/api/src/services/follows.ts`, `apps/web/src/components/creator/creator-header.tsx`.

Forwarded from feature/release-0.2.2 (2026-04-11).
