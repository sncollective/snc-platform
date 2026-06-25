---
id: creator-programming-e2e-golden
kind: story
stage: implementing
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
- [ ] All 5 cases green against the seeded service stack.
- [ ] Pure-UI assertions; no `request`/API calls from the test body (matches the 16 existing specs).
- [ ] Run: `bun run --filter @snc/e2e test -- creator-programming.spec.ts` (first run on a fresh
      container needs `bash scripts/dev/install-e2e-browsers.sh`).

## Test integrity
Park genuine product bugs (don't hide); fix drifted selectors/fixtures in-session; never game an
assertion green. A red spec documenting a real break beats a green one that lies. The grounded
selectors are from a read pass — verify against the live DOM and repair drift as test debt.
