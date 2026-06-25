---
id: creator-programming-e2e-golden
kind: story
stage: done
tags: [testing, streaming, playout]
parent: creator-programming-e2e
depends_on: []
release_binding: null
gate_origin: null
created: 2026-06-25
updated: 2026-06-25
---

# Spec A — provisioned Programming surface (golden path)

Unit 1 of `creator-programming-e2e`. Buildable now (Maya's provisioned channel landed in
`seed-demo.ts`, commit f9691ac).

## Scope
**File**: `apps/e2e/tests/creator-programming.spec.ts` (new).

**Invariant**: a creator with `manageStreaming` on a provisioned channel can assign their own
content to the pool, see it become queueable (with a "Content" badge), play-next it into the queue,
and never see another creator's content offered.

Auth: `test.use({ storageState: "auth/stakeholder.json" })` (Maya, owner of `maya-chen`). Follow
`apps/e2e/tests/creator-manage.spec.ts` + `apps/e2e/tests/helpers/nav.ts` (`contextNav`).

Test cases (all UI assertions — NO API probes from the test body; the suite's committed boundary):
1. Programming tab renders the real surface (Now Playing / Queue / Content Pool headings), NOT the
   "Set up streaming" affordance.
2. `+ Add Content` → `getByLabel("Search content")` → search "Studio" → select `Studio Tour 2026`
   → it appears in the `aria-label="Content pool"` table.
3. `+ Add to Queue` → picker (`getByLabel("Filter pool items")`) lists the item with a **"Content"**
   badge (`pool-item-picker.tsx:119`; pre-B1-fix content was filtered out — this is the regression
   guard for that fix).
4. Select the item → no error banner → it appears in the `aria-label="Upcoming queue"` list.
5. Cross-tenant isolation: searching `+ Add Content` for Jordan's "Open Mic" returns no results.

## Acceptance
- [x] All five cases green against the seeded service stack (the 3 pool-mutating cases on chromium;
      the 3 surface/read cases on both projects). No skips against product bugs — the blocking bug
      was drained with a full fix (see below), not gamed.
- [x] Pure-UI assertions; no `request`/API calls from the test body (matches the existing specs).
- [x] Run: `bun run --filter @snc/e2e test -- creator-programming.spec.ts` (first run on a fresh
      container needs `bash scripts/dev/install-e2e-browsers.sh`).

## Implementation notes
- **Files changed**: `apps/e2e/tests/creator-programming.spec.ts` (new — the spec). The blocking
  product bug fix landed alongside in `apps/api/src/services/playout-orchestrator.ts` +
  `apps/api/tests/integration/creator-playout/cross-tenant-isolation.test.ts` (commit 0c24d10).
- **Result**: green. `bun run --filter @snc/e2e test -- creator-programming.spec.ts` → 10 passed,
  3 skipped, exit 0 (the 3 skips are the pool-mutating cases on the mobile project — see isolation
  design below). Full-suite run green (`122 passed, 7 skipped`). `tsc --noEmit` on `apps/e2e` clean.
  Idempotent across consecutive runs (verified twice from a deliberately dirty pool — the reset
  drains it each time).
- **All five cases green**: (1) Programming nav link reaches the provisioned surface; (2) renders the
  real editorial surface (Now Playing / Queue / Content Pool headings; "Set up streaming…" absent);
  (3) assigns own content to the pool; (4) pooled content is queueable with a "Content" badge;
  (5) play-next queues the item; (6) cross-tenant isolation — Jordan's "Open Mic" returns "No
  matching content" in Maya's search.

### Blocking product bug — DRAINED (`creator-content-search-excludes-ready-status`, fixed in 0c24d10)
The e2e caught a real enum-mismatch bug on first run: the creator "+ Add Content" search
(`searchAvailableContent`, ~line 1067) and the autoFill candidate query (~line 909) filtered creator
content on `processing_status = 'completed'`, but content's terminal "done" state is **`'ready'`**
(`PROCESSING_STATUSES`); `'completed'` belongs to `PROCESSING_JOB_STATUSES`. So a creator's own ready
video never surfaced in search — the pool stayed empty. Per test integrity, the bug was parked when
caught, then immediately drained as a single stride: both call sites now match `'ready' OR IS NULL`.
The fix was invisible to typecheck (both columns are plain strings), unit tests (mocked; fixtures
chose passing values), and integration (fixtures left status null → hit the `IS NULL` arm) — only
the e2e exercising real seeded `ready` content surfaced it. The integration fixture
(`CONTENT_A1_ID`) now sets `processingStatus: "ready"` so the suite exercises the same arm the
product hits.

### Shared-state isolation design (the 3 pool-mutating cases)
Assigning content to the pool is a **persistent** write against the shared demo DB (`channel_content`),
and the content search deliberately hides already-pooled items (`NOT IN (pool)`), so the three cases
that search→assign Studio Tour collide: the first to assign it makes the rest find "No matching
content". The mutation also persists across runs and across the two Playwright projects
(`fullyParallel`, one shared DB, Maya the only seed-provisioned creator). Resolution:
- The 3 pool-mutating cases live in a separate `describe` configured `mode: "serial"` and **skip on
  every project except chromium** (a `beforeEach` `test.skip` guard). The assign/queue path is
  backend-scoped and viewport-independent, so running it on one project loses no coverage; the
  viewport-sensitive pool render (table vs. card dual-render) stays dual-project via the read-only
  "renders the real editorial surface" case.
- A `beforeEach` `resetMayaProgramming(page)` drives the surface's own UI to drain Maya's queue then
  pool (queue first — a queue entry pins its pool item), so each case starts clean regardless of run
  order or prior runs. Pure-UI, no API reach-around — preserves the suite's black-box boundary.
- The reset gates on the pool heading's ` (N items)` count before counting remove buttons. That
  parenthetical only renders once the queue-status fetch resolves, so it's the deterministic
  "pool data loaded" signal — counting remove buttons before the rows hydrate would read 0 and skip
  the drain. Remove buttons are scoped to the visible dual-render copy (`.filter({ visible: true })`).

### Selector drift / discoveries (fixed in-session as test debt)
- **Content Pool heading** renders `Content Pool (N items)` once loaded, bare `Content Pool` before
  the queue-status fetch resolves. `getByRole` `name` is substring-by-default, so `{ name: "Content
  Pool" }` matches either — but the ` (N items)` form is the load-bearing "loaded" signal the reset
  gates on (above). "Now Playing" and "Queue" headings are exact.
- **ResponsiveTable dual-renders** the pool as both a `<table>` and a card `<ul>`, *both* carrying
  `aria-label="Content pool"` and both always in the DOM (CSS container query toggles visibility).
  Row assertions scope to the visible view per viewport via the `contentPool()` helper (`table` on
  desktop, `list` on mobile); the reset scopes remove buttons via `.filter({ visible: true })` — both
  avoid strict-mode double matches.
- **Hydration race on the pickers**: the surface is SSR'd then hydrated; the *first* click on
  "+ Add Content" / "+ Add to Queue" after the page paints is swallowed before React attaches the
  toggle handler (reproduced via keyboard activation too — not a pointer/click-outside artifact).
  Handled with an `openPicker()` helper that retries the click→assert with `toPass` until the
  picker input is visible. Deterministic, not a fixed sleep.
- **`networkidle` is unusable** here — the queue poll (3s) + SSE spine keep the network busy, so
  `waitUntil: "networkidle"` times out. Gate on the `Content Pool` heading instead.
- **Auth rate-limit during iteration**: `global.setup.ts` re-logs-in all 3 demo users per run;
  rapid reruns trip `RATE_LIMIT_EXCEEDED` (429) at sign-in. For iteration, `playwright test … --no-deps`
  reuses the cached `auth/*.json` storage states and skips the setup login. The final verification
  ran the full command (with setup) green.

## Test integrity
Park genuine product bugs (don't hide); fix drifted selectors/fixtures in-session; never game an
assertion green. A red spec documenting a real break beats a green one that lies. The grounded
selectors are from a read pass — verify against the live DOM and repair drift as test debt.

## Review (2026-06-25)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none

**Notes**: Fast-lane story review. Verification green and reproduced this session — full golden
spec `10 passed, 3 skipped` (the 3 skips are the pool-mutating cases on the mobile project, by
design), full e2e suite `122 passed, 7 skipped`, `apps/e2e` typecheck clean, idempotent across two
consecutive runs from a deliberately dirty pool. The blocking product bug
(`creator-content-search-excludes-ready-status`) was caught by this spec, parked, then drained as a
single stride (commit 0c24d10) rather than skipped — exemplary test-integrity handling. Shared-state
isolation (serial + chromium-only + UI-driven `beforeEach` reset gated on the loaded `(N items)`
signal) is sound and documented. Parent feature `creator-programming-e2e` stays active.
