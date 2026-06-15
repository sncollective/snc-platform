---
id: e2e-suite-drift-triage
tags: [testing]
created: 2026-06-11
---

> **Resolved 2026-06-15.** Triaged against the live dev stack (full Docker +
> PM2 environment available this session). Baseline was **95 pass / 18 fail**;
> after fixes the suite is **green: 109 pass, 4 documented skips, 0 fail**.
> 16 of 18 failures were test-side drift; 2 were a real product bug now parked
> as `content-manage-list-not-responsive-mobile` (mobile content-row grid
> collapses the title to width:0 — confirmed via Playwright boundingBox).
> Test-side fixes: viewport-aware nav helper (`apps/e2e/tests/helpers/nav.ts`)
> replacing hardcoded desktop nav labels (BottomTabBar "Primary navigation" /
> chipBar "X mobile navigation" at <768px); landing heading/region "Featured
> Creators"→"Creators"; admin-playout "Playlist"→"Queue"; Maya strict-mode
> scoping; logout `button`→`menuitem` (Ark UI); theater-mode skip on mobile
> (desktop-only by design); mobile chat-input skip when no publisher is
> streaming. The 4 skips: 2× the parked mobile bug, theater-mode-desktop-only,
> mobile-chat-needs-stream. Promote to scope only if the parked bug or a new
> drift wave needs a tracked pass; otherwise this is done.

# E2e suite drift triage — ~17/113 failing after the suite became runnable again

The e2e suite was un-runnable from late April to 2026-06-11: the lockfile's
playwright-core (1.59.1) hits an upstream extraction-deadlock on Node 24.16+
(microsoft/playwright #40998), so browsers could never install. With the bump to
^1.60.0 the suite runs again: 96/113 pass; the failures look like app/data drift
accumulated since the tests were last touched (2026-04-24), e.g. strict-mode
violations (`getByText('Maya Chen')` resolves to 2 elements — likely the context-shell
nav redesign), and missing elements on the admin playout page and auth flow.

Triage each failure per test-integrity: stale assertion/fixture → fix the test; real
product regression → its own story. Artifacts in `apps/e2e/test-results/` from the
2026-06-11 run (screenshots + error context per failure).

## Absorbed drift detail (archived 2026-06-15 into this triage)

Seven 2026-04-15-CI items + the 2026-04-24 first-run tracker were archived as ref-stubs;
their per-failure specifics, consolidated here so triage is self-contained:

- **landing-page-heading-drift** — `landing.spec.ts:4/18`: asserts h2 "Featured Creators"; the
  0.2.7 redesign renamed to "Creators" + new sections ("Fresh Drops","What's On","Coming Up").
  Test-side rewrite (heading also conditional on `featuredCreators.length>0` → empty-state risk).
- **maya-strict-mode-violations** — `navigation.spec.ts:6/21`, `creator-manage.spec.ts:6/17`:
  `getByText('Maya Chen')` matches 2 els (user-menu `_userName_` + nav `_contextLabel_`/creator-card
  `_displayName_`). Use `getByRole('link',{name:/Maya Chen/})` or `.first()`. Test-side.
- **admin-playout-playlist-heading-drift** — `admin-roles.spec.ts:31`: asserts "Playlist" heading on
  /admin/playout, removed in 0.2.1 restructure. Also `:39` "Now Playing" is conditional on playout
  channel presence (empty-channel cascade). Update selectors.
- **mobile-nav-sidebar-hidden-drift** — 6 mobile failures (navigation/content-feed/content-manage/
  creator-manage/admin-roles): assert `role=navigation` for sidebars `display:none` at mobile.
  **Requires a UX decision** — admin/creator-manage context shells have no mobile nav surface; add one
  (real UX gap) or split specs by viewport.
- **content-manage-ssr-fetch-race** + **pat-morgan-user-list-render** — SSR-shell-then-client-fetch
  race class: content-detail/content-manage/admin-roles specs time out on post-hydration data.
  Candidate fix: convert these routes to TanStack Start loaders (server-render on first paint). Likely
  one root cause across all three; **possible real product fix, not just test-side.**
- **snc-tv-channel-seed-gap** — `live-streaming.spec.ts:4`: asserts `option /S\/NC TV/`;
  `seed-channels.ts` declares the broadcast row but `seed:demo` doesn't run it. Seed-ops: run
  `seed:channels`. Cascades to Theater-mode + Chat assertions on the same page.
- **auth-flow register→logout** (`auth-flow.spec.ts:25`) — email-verification branch + no Mailpit in
  CI. Disable verification for e2e CI, add Mailpit service + click-through, or split into
  register-only + login-with-seeded-user.

Triage each per test-integrity (stale assertion → fix test; real regression → own story); the
SSR-race + mobile-nav-UX items may be genuine product work, not just selector fixes.
