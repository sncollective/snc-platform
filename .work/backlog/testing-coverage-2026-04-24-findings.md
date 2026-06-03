---
tags: [testing, batch-tracker]
release_binding: null
created: 2026-04-24
---

# E2E coverage findings batch — 2026-04-24 (0.3.0 gate)

Batch-tracker for the e2e coverage gaps surfaced during the 0.3.0 testing-gate triage that were not bound to 0.3.0 as release blockers. Two gaps were bound and shipped with the release; everything below is deferred.

The bound-and-shipped: testing-landing-coming-up-event-row, testing-live-page-chat-panel-render.

## Deferred coverage gaps

### Admin creators data table (new `/admin/creators` route)
Zero e2e coverage on the new TanStack Table-backed admin creators management page. admin-roles.spec.ts covers the admin sidebar + playout/simulcast but doesn't navigate to `/admin/creators`. Loader error or table component crash would be invisible to the suite. Not event-day critical — admin-only path.

### Invite accept page error state
Zero coverage on `/invite/$token`. Even a basic "authenticated user + invalid token shows error state, not a crash" test would guard against unhandled loader crashes. Not event-day critical — invites aren't used during the livestream itself. Pair with the `security-invite-audit-log-gap` testing concern when scoping.

### Chat send/receive + WebSocket round-trip
The render-level chat panel test (from `testing-live-page-chat-panel-render`) covers mount. Full protocol testing — connect, join room, send message, receive broadcast, reaction toggles, moderator timeout/ban flows — requires a running WebSocket server with seeded room state and substantial test infrastructure. Post-0.3.0 scope.

### Patron badges in chat messages
No e2e verifies a patron badge renders on a chat message for a subscribed user. Requires a subscription fixture + patron auth state. Depends on the WebSocket round-trip infrastructure above.

### Resumable uploads (tus) round-trip
No e2e coverage of the Uppy/tus upload flow, progress display, or resume-on-refresh. Requires a running tusd container + a large binary fixture — infeasible in the current golden-path e2e setup against staging. Unit/integration tests cover the hook + server logic; prod verification handles the end-to-end S3 case. Post-0.3.0 scope.

### Notification inbox UI (`/settings/notifications`)
No spec navigates the notifications settings route or asserts inbox notification items render. Pair with the notification-preferences-ui-nav-link item when scoping.

### Creator profile head() title isolation (SEO fix)
No e2e asserts `page.title()` equals the creator's display name rather than the generic site-wide title. SEO regression is detectable post-event via lighthouse / crawl. Not user-visible on event day.

### Event-form edit visibility preservation
No e2e covers editing a calendar `show`-type event and asserting visibility stays at `subscribers`. The fix is a deletion at the web-component layer; a unit test on the form would actually catch it better than an e2e. Low event-day risk.

### Mobile nav bottom tab bar structural assertion
Responsive spec only checks `scrollWidth` overflow at 320px. Does not assert the bottom tab bar renders or nav items are reachable on mobile. Visually verifiable during manual smoke.

### Streaming-account-connect OAuth start + callback redirect
Already marked as OUT-OF-E2E in the 0.3.0 bundle's `## Prod verification` section — requires real Twitch/YouTube dev-app credentials. Not e2e-addressable.

### Access-model non-admin team member journey
Already marked as OUT-OF-E2E in the 0.3.0 bundle — prod-only because dev uses admin-bypass for the manage area.

## Pre-existing e2e failures surfaced during the gate run

Running `landing.spec.ts` + `live-streaming.spec.ts` against staging during the 0.3.0 gate showed three pre-existing failures unrelated to 0.3.0 content:

- `[chromium + mobile] Landing page › loads with hero section and featured creators` — hero section `toBeVisible()` times out. Likely staging-state drift (demo seed vs. dev changes accumulating during the session); re-seeding would probably fix.
- `[mobile] Live streaming page (authenticated) › theater mode toggle is present` — mobile-only; theater-mode button may be hidden by responsive CSS at that viewport.

Worth a brief maintenance pass post-release to stabilize before they become real CI blockers.

## How to consume this

`/scope <topic>` to promote sub-clusters. The WebSocket infrastructure for full chat e2e is the largest of these — likely a design-first pass. The rest are small self-contained spec additions.

## Revisit if

- CI starts gating on the pre-existing failures above (they become a real release blocker).
- E2E infrastructure expands to support WebSocket round-trips (unblocks the chat cluster).
- A coverage-impact incident (a regression slipping past the suite into prod) changes the risk calculus — revisit the "not event-critical" designations.
