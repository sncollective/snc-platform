---
id: creator-programming-e2e-golden
kind: story
stage: review
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
- [x] All cases green or honestly skipped against the seeded service stack — 3/5 cases green; 2
      net cases (assign / queueable-badge / play-next — 3 named cases, see below) skipped against a
      parked product bug, not gamed.
- [x] Pure-UI assertions; no `request`/API calls from the test body (matches the existing specs).
- [x] Run: `bun run --filter @snc/e2e test -- creator-programming.spec.ts` (first run on a fresh
      container needs `bash scripts/dev/install-e2e-browsers.sh`).

## Implementation notes
- **Files changed**: `apps/e2e/tests/creator-programming.spec.ts` (new — the only production file).
- **Result**: green. `bun run --filter @snc/e2e test -- creator-programming.spec.ts` → 7 passed
  (6 spec cases across chromium + mobile + 1 auth setup), 6 skipped (the 3 blocked cases × 2
  projects), exit 0. `tsc --noEmit -p apps/e2e/tsconfig.json` clean. Stable across 3 consecutive
  `--no-deps` reruns (no flake). Browsers installed via `scripts/dev/install-e2e-browsers.sh`.
- **Cases green (3)**: (1) Programming tab renders the real surface — Now Playing / Queue / Content
  Pool headings present, "Set up streaming…" affordance absent; (1b) the Programming nav link from
  the creator-manage context nav reaches the surface (added as an extra guard); (5) cross-tenant
  isolation — searching Jordan's "Open Mic" in Maya's "+ Add Content" returns "No matching content".
- **Cases skipped (3) — `test.skip` linked to backlog `creator-content-search-excludes-ready-status`**:
  (2) assign own content to pool, (3) queueable with a "Content" badge, (4) play-next into the
  Upcoming queue. All three depend on Maya's `Studio Tour 2026` reaching the pool through the
  "+ Add Content" search, which is blocked by the product bug below. They are written in full (so
  they re-activate by deleting one `test.skip(true, …)` line each once the fix lands), not stubbed.

### Product bug parked (blocks cases 2/3/4) — `creator-content-search-excludes-ready-status`
The creator "+ Add Content" search (`searchAvailableContent`, `apps/api/src/services/playout-orchestrator.ts:1067`)
and the autoFill candidate query (same file, ~line 909) filter creator content with
`c.processing_status = 'completed' OR c.processing_status IS NULL`. But content's `ProcessingStatus`
vocabulary is `["uploaded","processing","ready","failed"]` (`packages/shared/src/content.ts:12`) —
the terminal "done" state is **`'ready'`**, and `'completed'` is never written to the content table
(it belongs to `PROCESSING_JOB_STATUSES`, a different enum). The transcode/probe pipeline sets
content to `'ready'` (`transcode.ts:87`, `probe-codec.ts:86`). Verified in the demo DB:
`Studio Tour 2026` is `processing_status = 'ready'` and is excluded from Maya's search — the pool
stays empty. Net effect: a creator can never add their own processed video to their pool via search.
Fix: accept `'ready'` at both call sites. Parked, not fixed here (out of this item's scope).

### Selector drift / discoveries (fixed in-session as test debt)
- **Content Pool heading** renders `Content Pool (N items)`, not bare `Content Pool`. `getByRole`'s
  string `name` is substring-by-default, so `{ name: "Content Pool" }` still matches — but worth
  recording. "Now Playing" and "Queue" headings are exact.
- **ResponsiveTable dual-renders** the pool as both a `<table>` and a card `<ul>`, *both* carrying
  `aria-label="Content pool"` and both always in the DOM (CSS container query toggles visibility).
  Row assertions are scoped to the visible view per viewport via the `contentPool()` helper
  (`table` on desktop, `list` on mobile) to avoid strict-mode double matches.
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
