---
tags: [testing, community]
release_binding: null
created: 2026-04-20
---

# Testing: notification bell e2e coverage

Verify golden-path e2e coverage for the notification bell mounted in the nav bar for authenticated users: bell is visible when logged in, hidden when logged out, badge count renders correctly, and the dropdown opens and dismisses.

Relevant files: `apps/web/src/components/layout/nav-bar.tsx`, `apps/web/src/components/notification-bell.tsx`.

Forwarded from feature/release-0.2.5 (2026-04-04).
