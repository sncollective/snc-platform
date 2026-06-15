---
date: 2026-06-15
tags: [testing, e2e, dev-env]
session_type: e2e drift triage → green (live stack unblocked)
related_items:
  - e2e-suite-drift-triage
  - content-manage-list-not-responsive-mobile
---

# Session: e2e suite drift triage → green, against a live dev stack

Picked up from `2026-06-15-backlog-audit-prune-and-roadmap`, whose central blocker
was that the Bash-tool sandbox kept docker.sock + the pm2 socket at EPERM, so the
orchestrator couldn't bring up or verify the dev stack. **This environment cleared
that** — `docker` and `pm2` both work directly, the full stack was already healthy
(PG/Garage/SRS/Liquidsoap/imgproxy/tusd/Mailpit), and api/web were live on :3082/:3000.
That made the **E2E recovery** arc (user's pick) tractable end-to-end.

## Outcome

E2E suite **95 pass / 18 fail → 109 pass, 4 documented skips, 0 fail.**

Triaged all 18 failures **from ground truth** (read the live DOM + source, not the
2026-06-11 triage note's inferences). The note had pre-classified the mobile-nav
cluster as a possible UX gap and auth-flow as an email-verification block — **both
wrong**, caught only because the live app was inspectable:

- **Mobile nav is NOT a UX gap.** The app has a proper responsive pattern: main nav
  hidden <768px, replaced by `BottomTabBar` (aria-label "Primary navigation"); context
  shells swap sidebar→chipBar (aria-label "X mobile navigation"). Specs just hardcoded
  desktop labels. → new `apps/e2e/tests/helpers/nav.ts` picks the surface by Playwright
  project name.
- **auth-flow is NOT email-verification.** Register auto-signs-in
  (`requireEmailVerification: false`, session cookie on sign-up — verified against the
  live API). The real cause: logout is an Ark UI `MenuItem` (role=menuitem), the test
  used role=button.

### Test-side drift (16 failures, all fixed)
landing "Featured Creators"→"Creators" (heading + region, 0.2.7); admin-playout
"Playlist"→"Queue" (0.2.1); Maya strict-mode (2 nodes: user-menu + context-label)
scoped; viewport-aware nav across landing/navigation/admin-roles/creator-manage/
content-manage/content-feed; logout menuitem; theater-mode desktop-only skip; mobile
chat-input skip when no publisher on the stack.

### Real bug (2 failures, parked not papered-over)
`content-manage-list-not-responsive-mobile`: the content-row grid
(`content-row.tsx:134` inline `gridTemplateColumns`, CSS module with **zero** media
queries, `.gridCell` lacks `min-width:0`) collapses the title link to **width:0**
below 768px — confirmed via Playwright `boundingBox` (width=0, visible=false, single
element — not a duplicate, not behind a toggle). Per test-integrity, filed as backlog
+ skip-linked the two affected mobile specs rather than asserting on a known-broken
layout.

## Process notes

- The live stack is the whole story. Every "is this a test bug or a product bug?"
  question got a definitive answer by inspecting the running DOM (Playwright
  `boundingBox`/`isVisible`, live API probes via `bun -e fetch` since curl is
  policy-blocked). The 2026-06-11 note's two misclassifications would have shipped as
  wrong fixes without it.
- Fixing surfaced second-order failures (navigation:23 profile strict-mode was masked
  by the earlier line-12 failure; creator-manage mobile chipBar carries no display-name
  label). Re-ran to green, didn't assume first pass was complete.
- `bunx tsc --noEmit` shows 2 pre-existing errors in `playwright.config.ts` (process
  types, exactOptionalPropertyTypes) — NOT mine, and runtime-irrelevant (suite runs
  green). Left them; could be a tiny separate cleanup.

## Resume map

- `platform/.work/` backlog now 159 (added the content-manage mobile bug). `main` has
  2 new commits (park + the e2e drift fix); not pushed (user's call).
- The dev stack + browsers are now a **durable autonomous-verification asset** for the
  rest of the roadmap. The streaming-reliability arc — the one last session flagged as
  "implement-only, user fix-verifies, no in-sandbox verify" — is now agent-verifiable
  against the live SRS/Liquidsoap stack. That's the natural next arc.
- Next e2e step if desired: an e2e-coverage epic for the genuinely-uncovered
  `testing-*-e2e` items (creator-follow-unfollow, creator-lifecycle, etc.) now that the
  suite is a trustworthy green baseline.
