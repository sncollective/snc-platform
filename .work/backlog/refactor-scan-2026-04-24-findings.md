---
id: refactor-scan-2026-04-24-findings
tags: [refactor, batch-tracker]
release_binding: null
created: 2026-04-24
---

# Refactor-scan findings batch — 2026-04-24 (0.3.0 gate)

Batch-tracker for the high-value refactor findings surfaced during the 0.3.0 refactor-gate scan (full-codebase, 7 libraries, 438 source files) that were **not bound to 0.3.0** as release blockers. Five findings were bound and fixed inline; everything below is deferred.

The bound-and-fixed set (for reference): [fix-invite-email-frontend-url](../../.memory/archive/TODO-when-released), [fix-frontend-base-url-fallback-port](../../.memory/archive/TODO-when-released), [fix-creator-profile-head-title-clobber](../../.memory/archive/TODO-when-released), [fix-event-form-visibility-clobber-on-edit](../../.memory/archive/TODO-when-released), [fix-s3-upload-stream-buffering](../../.memory/archive/TODO-when-released).

> **Pruned 2026-06-18 (groom):** the "## Existing-item scope expansions" block was removed — all
> four features it folded findings into (`refactor-pattern-compliance-sweep`,
> `refactor-route-file-size-splits`, `refactor-component-splitting-oversized-files`,
> `refactor-jsdoc-exported-constants`) shipped done + archived 2026-06-15, discharging those
> findings. The standalone work below was never tied to a shipped feature and remains open.

## New standalone work (not covered by existing features)

### N+1 query patterns — runtime cost, needs own feature

Three distinct sites where per-row DB queries run inside loops over audience lists:

- [chat-moderation.ts:getActiveSanctions](../../apps/api/src/services/chat-moderation.ts) — line 261. Per-banned-user query for unbans.
- [notification-dispatch.ts:dispatchNotification](../../apps/api/src/services/notification-dispatch.ts) — line 106. Per-audience-member preference query + DB insert + `boss.send`, all sequential.
- [event-reminder.ts:handleEventReminderDispatch](../../apps/api/src/jobs/handlers/event-reminder.ts) — line 44. Per-reminder `inbox_notifications` dedup check.

All three have batch-fetch rewrites. `/scope` as one feature with three child stories.

### Dual WebSocket connection dedup

[chat-context.tsx:266-416](../../apps/web/src/contexts/chat-context.tsx#L266-L416) and [notification-context.tsx:73-79](../../apps/web/src/contexts/notification-context.tsx#L73-L79) each maintain their own reconnecting WebSocket to `/api/chat/ws` with identical exponential-backoff logic. Extract `useReconnectingWebSocket` primitive; consolidate to one shared connection. Single story.

### Small wins (individually low-ROI but trivial)

- **`formatDuration` triplicated** — [content-search-picker.tsx:18](../../apps/web/src/components/admin/content-search-picker.tsx#L18), [pool-item-picker.tsx:17](../../apps/web/src/components/admin/pool-item-picker.tsx#L17), [content-pool-table.tsx:17](../../apps/web/src/components/admin/content-pool-table.tsx#L17). Extract to `lib/format-duration.ts`.
- **`<div role="button">` in 2 admin pickers** — replace with native `<button type="button">` in content-search-picker.tsx and pool-item-picker.tsx.
- **`HANDLE_REGEX` inlined in admin.ts** — [admin.ts:49](../../packages/shared/src/admin.ts#L49) should import from [creator.ts](../../packages/shared/src/creator.ts).
- **`getContentStatus` ignores `mediaUrl` + `type` params** — [content.ts:101](../../packages/shared/src/content.ts#L101). Public shared API; drop the unused params.
- **Written-body paragraph splitting duplicated** — [written-detail.tsx:46](../../apps/web/src/components/content/written-detail.tsx#L46) and [written-detail-view.tsx:33](../../apps/web/src/components/content/written-detail-view.tsx#L33). Extract `splitBodyParagraphs`.
- **SSR pathname guard duplicated** — [audio-detail-view.tsx:78](../../apps/web/src/components/content/audio-detail-view.tsx#L78), [video-detail-view.tsx:63](../../apps/web/src/components/content/video-detail-view.tsx#L63). Extract `getCurrentPathname()` to `lib/url.ts`.
- **`ensureBroadcast` / `ensurePlayout` dedup** — [channels.ts:231+282](../../apps/api/src/services/channels.ts#L231). Extract private `ensureChannel` helper.
- **Twitch/YouTube state-validation dedup** — [streaming-connect.ts:80](../../apps/api/src/services/streaming-connect.ts#L80). Extract `validateState(state, platform)`.
- **`playout-orchestrator` refill-and-push pattern duplicated** — [playout-orchestrator.ts:326-338+508-523](../../apps/api/src/services/playout-orchestrator.ts). Extract `refillAndPush(channelId)` helper.
- **Thin wrapper files** — [project-item.tsx](../../apps/web/src/components/project/project-item.tsx) vs `manage-project-item.tsx`, and `project-form.tsx` vs `manage-project-form.tsx`. Collapse wrappers or inline at callsites.
- **Project CRUD duplication** — [governance/projects.tsx](../../apps/web/src/routes/governance/projects.tsx) vs [creators/$creatorId/manage/projects/index.tsx](../../apps/web/src/routes/creators/$creatorId/manage/projects/index.tsx); same for the detail routes. Extract `useProjectList(params?)` hook + `ProjectDetailView` component.
- **`manage/settings.tsx` re-fetches creator** — [settings.tsx:78](../../apps/web/src/routes/creators/$creatorId/manage/settings.tsx#L78) has a `useEffect` that calls `fetchCreatorProfile` when the parent layout already provides it via `getRouteApi().useLoaderData()`.

## Accessibility gaps (consider consolidating into a dedicated a11y story)

- **Chat room tab buttons missing `role="tab"` / `aria-selected`** — [chat-panel.tsx:105-118](../../apps/web/src/components/chat/chat-panel.tsx#L105-L118). WCAG 4.1.2.
- **Manage pages use h2 as first heading** — [manage/streaming.tsx:175](../../apps/web/src/routes/creators/$creatorId/manage/streaming.tsx#L175), [manage/calendar.tsx:30](../../apps/web/src/routes/creators/$creatorId/manage/calendar.tsx#L30). WCAG 1.3.1.
- **`FollowButton` uses `disabled` + tooltip** — [follow-button.tsx:68-72](../../apps/web/src/components/creator/follow-button.tsx#L68-L72). Keyboard users can't reach the tooltip. Use `aria-disabled`.
- **Simulcast form errors not associated via `aria-describedby`** — [simulcast-destination-manager.tsx:188-190](../../apps/web/src/components/simulcast/simulcast-destination-manager.tsx#L188-L190).
- **Landing scroll containers with `tabIndex={0}` but no visible focus ring** — [featured-creators.tsx:29](../../apps/web/src/components/landing/featured-creators.tsx#L29), [whats-on.tsx:33](../../apps/web/src/components/landing/whats-on.tsx#L33).
- **`admin/playout.tsx` tablist without arrow-key nav** — line 349. WAI-ARIA APG tab pattern requires keyboard navigation.
- **`admin/playout.tsx` input without label** — line 390. Placeholder isn't a substitute.
- **`admin/creators.tsx` action buttons missing `type="button"`** — inside form context could trigger submit.

## SEO gaps (consolidate into a dedicated SEO story)

- **6 auth/utility routes missing description + OG tags** — login, register, forgot-password, checkout/success, checkout/cancel, invite/$token.
- **5 manage/admin routes missing `head()` entirely** — manage/index, manage/calendar, manage/projects/index, manage/members, admin layout. Generic "S/NC" title across all.
- **Governance projects — dynamic project title lost** — [governance/projects_.$projectSlug.tsx:29](../../apps/web/src/routes/governance/projects_.$projectSlug.tsx#L29) uses static head() despite loaderData carrying project.name.
- **ItemList structured data opportunity** — [merch/index.tsx](../../apps/web/src/routes/merch/index.tsx), [creators/index.tsx](../../apps/web/src/routes/creators/index.tsx).

## Floating-promise and cleanup gaps

- **Untracked setTimeout** — [chat-context.tsx:363](../../apps/web/src/contexts/chat-context.tsx#L363) — `setTimeout(CLEAR_FILTERED, 3000)` stores no timer ID, can't cancel on unmount.
- **Unvoided `.then()` in useEffect** — [use-notifications.ts:33](../../apps/web/src/hooks/use-notifications.ts#L33).
- **Floating promise in chat WS dispatch** — [chat.routes.ts:220-241](../../apps/api/src/routes/chat.routes.ts#L220-L241) — inner `then(async...)` with un-caught `await getReactionsBatch`.
- **6 dynamic imports at module bootstrap without void** — [app.ts:117](../../apps/api/src/app.ts#L117).
- **Bare `main()` at script entry** — [scripts/seed-channels.ts:59](../../apps/api/src/scripts/seed-channels.ts#L59).
- **Three `void pushUnreadCount()` without `.catch()`** — [notification-inbox.ts:72,144,161](../../apps/api/src/services/notification-inbox.ts).

## Missing return types (sweep)

Exported component functions without explicit `React.ReactElement` return type: [login-form.tsx](../../apps/web/src/components/auth/login-form.tsx), [register-form.tsx](../../apps/web/src/components/auth/register-form.tsx), [change-password-form.tsx](../../apps/web/src/components/auth/change-password-form.tsx), and the ui wrappers [select.tsx](../../apps/web/src/components/ui/select.tsx), [dialog.tsx](../../apps/web/src/components/ui/dialog.tsx), [menu.tsx](../../apps/web/src/components/ui/menu.tsx). Email formatters ([go-live.ts](../../apps/api/src/email/templates/go-live.ts), [invite.ts](../../apps/api/src/email/templates/invite.ts), [new-content.ts](../../apps/api/src/email/templates/new-content.ts)) also lack explicit return types.

## Deferred / watch items

- **Mixed Zod v3 `z.string().datetime()` vs v4 `z.iso.datetime()`** in `packages/shared/` — behavior-equivalent in our usage; standardize opportunistically.
- **`packages/shared/src/chat.ts` at 423 lines** — watch item; cohesive WS-protocol surface.
- **`packages/shared/src/playout.ts` at 140 lines** — watch item.
- **`packages/shared/src/storage-contract.ts` vitest imports** — verify tree-shaking in shared build artifact before acting.
- **In-memory rate-limit Map** — per-process; informational for production awareness.

## How to consume this

`/scope <topic>` to promote specific sub-clusters to active work. `/schedule` a recurring audit if the codebase churn rate makes periodic re-scans valuable. Treat this document as a snapshot — don't update inline; re-scan when appropriate and write a new dated batch.
