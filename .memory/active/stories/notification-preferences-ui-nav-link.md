---
id: story-notification-preferences-ui-nav-link
kind: story
stage: review
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

- [x] Identify the correct nav surface per `platform-0010-nav-context-shell-pattern` (likely the settings sub-nav or user menu).
- [x] Add the nav link entry pointing at `/settings/notifications`.
- [x] Verify the link renders and routes correctly in both authenticated and unauthenticated states (auth-gated if the page itself is).

## What shipped

Nav surface turned out to be the **user menu dropdown** (not a settings sub-nav — settings routes don't use `ContextShell`; that pattern is scoped to admin / governance / creator-manage per `platform-0010`). Menu entries live in `apps/web/src/config/auth-menu-items.ts` as a data-driven array consumed by both the desktop `UserMenu` and mobile `AuthenticatedNav`.

Change: single menu entry inserted between Settings and Subscriptions.

```ts
items.push({ key: "notifications", to: "/settings/notifications", label: "Notifications", icon: Bell });
```

Plus a `Bell` import from `lucide-react`, and an updated JSDoc listing + expanded test in `tests/unit/components/user-menu.test.tsx` to assert the new menuitem.

Files touched:
- `apps/web/src/config/auth-menu-items.ts` — add entry + import
- `apps/web/tests/unit/components/user-menu.test.tsx` — expand assertion + rename test

Unauthenticated-state coverage: when the user is logged out, the user menu renders the logged-out variant (separate test block) — the auth menu items (including this new one) don't render at all. Auth-gating is inherited from the `/settings/notifications` route itself (`beforeLoad` redirects to login).

## Verification

- [x] Unit tests pass — full web suite (151 files, 1599 tests) green.
- [ ] **Browser verification pending** — standard project convention for UI changes. Open user menu while logged in; confirm "Notifications" link appears between "Settings" and "Subscriptions" with Bell icon; click routes to `/settings/notifications`. Mobile nav should show the same entry in the authenticated section. This is `/review`'s job.

## Risks

None meaningful — additive nav entry, no behavior change to the existing page or to other menu items.
