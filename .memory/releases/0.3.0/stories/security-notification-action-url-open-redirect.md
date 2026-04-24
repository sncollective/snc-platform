---
id: story-security-notification-action-url-open-redirect
kind: story
stage: done
tags: [security, community]
release_binding: 0.3.0
created: 2026-04-24
updated: 2026-04-24
related_decisions: []
related_designs: []
parent: null
---

Surfaced by the 0.3.0 security-gate scan (web + shared). **S1** (schema) + **S2** (client passthrough) — fix both together.

`InboxNotificationSchema.actionUrl` at [packages/shared/src/notification-inbox.ts:25](../../packages/shared/src/notification-inbox.ts#L25) is `z.string().nullable()` — unconstrained. The client at [use-notifications.ts:68](../../apps/web/src/hooks/use-notifications.ts#L68) does `window.location.href = notification.actionUrl` with no guard. Composition is an open-redirect / `javascript:`-URI vector if any path ever writes an untrusted or malformed value into the notification row.

All current `actionUrl` values are server-generated in-app paths, so exploitation requires either a server compromise or a buggy future notification flow. But the class of bug (trust on a loose schema) is exactly what the `schema-at-boundary` rule exists to prevent.

## What changes

1. **Shared schema** — tighten `actionUrl` from `z.string().nullable()` to `z.string().startsWith("/").nullable()`. Relative paths only. (Could use `z.string().url()` + origin check, but we have no legitimate external-URL use case in the inbox today.)
2. **Client** — use the existing `getValidReturnTo()` guard from `lib/url.ts` before assignment, so even if server drift slips a bad value through, the client double-checks: `window.location.href = getValidReturnTo(notification.actionUrl) ?? "/"`.

## Tasks

- [ ] Update `InboxNotificationSchema.actionUrl` in `packages/shared/src/notification-inbox.ts`.
- [ ] Update `use-notifications.ts` click handler to route through `getValidReturnTo()`.
- [ ] Audit existing code paths that write `actionUrl` — they should all be producing `/...` already; the new schema will enforce it via `safeParse` on any server-side consumer.
- [ ] Add a unit test: a notification with `actionUrl: "https://evil.example.com"` fails schema parse; a notification with `actionUrl: "javascript:alert(1)"` fails schema parse; `actionUrl: "/content/123"` passes.

## Verification

- Unit + schema tests green.
- Manual: click a notification in the inbox; navigation still works.
- Sanity: inspect API response for `/api/notifications` or equivalent; all `actionUrl` values should begin with `/`.

## Risks

Low. If a legitimate use case requires an absolute URL (e.g., a notification linking to an external partner site), revise to `z.string().url().startsWith(<origin>)` or an explicit allowlist. For now, relative-only is the safe default.
