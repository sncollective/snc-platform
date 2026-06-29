---
id: creator-programming-e2e
kind: feature
stage: done
tags: [testing, streaming, playout]
parent: unified-channel-model
depends_on: []
release_binding: 0.4.0
gate_origin: null
created: 2026-06-25
updated: 2026-06-25
---

# E2E coverage for the creator Programming surface (AC#5)

## Why
The `unified-channel-model-creator-enablement` arc made creators' editorial surface
(queue + content pool + play-next) work for their own content. Its **AC#5 live fix-verify**
— "a creator drives their own queue with their own content in the running app" — is a
platform-convention gate currently owed as a manual user step. This feature converts the
automatable majority of AC#5 into durable Playwright coverage, and scopes the one genuinely
manual/infra-bound piece (actual media playback) as its own tracked story.

The cross-model review loop on that arc converged (3 passes) on code correctness; this feature
is the regression guard so the behavior can't silently break later.

## What AC#5 asks, split by automatability (grounded)
The e2e stack runs the real app + real DB (seeded demo users, real auth) + SRS + Liquidsoap,
but has **no live media publisher** — existing live tests already skip anything needing a real
stream playing. So:

- **Automatable now (UI + queue-write):** Programming tab renders (gated on `manageStreaming`);
  a creator assigns their own content to the pool; the content appears in the "+ Add to Queue"
  picker with a **"Content"** badge (the B1 UI fix — content was previously filtered out);
  "play next" queues it (no error, lands in the queue); cross-tenant isolation (another
  creator's content / platform library is not offered).
- **Automatable but infra-bound (real playback):** there IS a machine signal — Liquidsoap POSTs
  a `track-event` when it starts a queue item → the item becomes `nowPlaying` in `/status`. But
  asserting it needs a creator-channel playout engine actually running in the test stack (today
  only the S/NC-TV broadcast channel renders+runs an engine — `liquidsoap-render.ts:68-79`).
  That's test-stack infrastructure, scoped as its own story.

## Groundwork already landed (not a child story — done)
- **Seed:** Maya's creator channel is now provisioned in `seed-demo.ts` (commit f9691ac) so the
  Programming tab hits the real surface deterministically. Idempotent; Jordan + Sam left
  unprovisioned on purpose so the lazy-provisioning path stays exercisable.

## Grounded facts for the spec authors (from the e2e grounding pass)
- Auth fixture `auth/stakeholder.json` = maya@snc.demo (owner of creator `maya-chen`, has
  `manageStreaming`). Maya's own video content: `Studio Tour 2026` (id …103). Cross-tenant
  creator: Jordan Ellis (`jordan-ellis`), videos incl. `Open Mic Night Highlights`, `Live at The
  Basement`.
- Programming nav link: `contextNav(page, testInfo, "Maya Chen").getByRole("link", { name:
  "Programming" })`; route `/creators/maya-chen/manage/programming`.
- Provisioned-surface selectors: `getByRole("button", { name: "+ Add Content" })` →
  `getByLabel("Search content")` (results listbox "Content search results", own content shows a
  "Creator" badge); pool table `aria-label="Content pool"`; `getByRole("button", { name: "+ Add
  to Queue" })` → picker `getByLabel("Filter pool items")`, per-item badge "Content"/"Playout"
  (`pool-item-picker.tsx:119`); queue list `aria-label="Upcoming queue"`.
- Empty-state (unprovisioned) selectors: `getByText("Set up streaming to start programming")`,
  `getByRole("link", { name: "Go to Streaming" })`.
- Existing patterns to follow: `apps/e2e/tests/creator-manage.spec.ts`, `helpers/nav.ts`
  (`contextNav`, desktop sidebar vs mobile chipBar). Service-stack e2e, golden-path style.

## Intended decomposition (for e2e-test-design to confirm/adjust)
- **Spec A — provisioned Programming surface** (golden path): the automatable UI + queue-write
  coverage above. Depends on the landed seed.
- **Spec B — lazy-provisioning path**: an unprovisioned creator (Jordan/Sam) → "set up streaming"
  affordance → create a stream key → channel provisions and the surface appears. (Couples to the
  Streaming-tab UI.)
- **Story C — full-pipeline playback assertion (infra)**: stand up / arm a creator-channel
  playout engine in the test stack (or route via S/NC-TV carry), drive a real publish, assert the
  `track-event → nowPlaying` callback + HLS manifest growth. This is the part that retires the
  manual AC#5 eyeball entirely. Larger; may itself decompose.

## Out of scope
Anything beyond creator Programming e2e — the editorial engine semantics, admin playout, viewer
presentation.

## Design decisions (e2e-test-design 2026-06-25, interactive)

- **Assertion layer = UI only (no API probes from test bodies).** Grounded, not preference: of the
  16 existing e2e specs, ZERO reach the API from a test body — `request` appears only in
  `global.setup.ts` to mint auth cookies (a setup primitive, never an assertion surface). Spec A
  asserts "play-next queued the item" via the **queue UI** (the item appears in the
  `aria-label="Upcoming queue"` list; no error banner), matching the suite's committed black-box
  boundary and the skill's anti-tautology guidance. The stronger DB-persistence guarantee is
  already covered by the integration tests (the cross-tenant suite asserts `playout_queue` rows
  directly), so the e2e layer doesn't duplicate it.
- **Full-pipeline playback (track-event→nowPlaying) is a SEPARATE linked story, not a child.** The
  creator-channel-playout-engine-in-test-stack work is reusable test infra (future streaming e2e
  would use it too), and keeping it out of this feature lets the UI coverage ship without waiting
  on the heavy infra. Scoped as `creator-channel-engine-e2e-infra` and linked below.

## Mock-boundary plan (deviation, recorded)

This project's e2e suite is **service-stack**, not service-level-mocked: every spec runs against
the real app + real PostgreSQL + real Garage/SRS/Liquidsoap with seeded data and real-login auth
(`global.setup.ts`). The skill's default "service-level mocks only" ladder does not fit the
established pattern, and forcing off-the-shelf mocks here would make these specs alien to the 16
that precede them. So:

| External dependency | Treatment | Justification |
|---|---|---|
| App, API, PostgreSQL, Garage | **Real (service-stack)** | The whole suite runs against the real stack; that IS the product under test. Not mocked. |
| Auth | **Real login → storage state** | Existing `global.setup.ts` pattern; `auth/stakeholder.json` = Maya (owner, `manageStreaming`). |
| Seed data | **Real demo seed** | Maya's provisioned channel + own content landed in `seed-demo.ts` (commit f9691ac). |
| **Live media publisher** (the one genuine gap) | **Out of scope here → the linked infra story** | The e2e stack has no publisher; asserting actual playback needs a creator-channel engine running. That's `creator-channel-engine-e2e-infra`, not this feature. |

No in-process mocks. The only "mock-like" element is the absence of a live publisher, which is
precisely what the linked infra story exists to supply.

## Taxonomy plan
- **Golden:** Spec A (provisioned Programming surface) — the core AC#5 UI journey.
- **Failure/edge:** Spec B (lazy-provisioning path) — the unprovisioned-creator → setup-affordance
  → first-stream-key → surface-appears flow, plus the cross-tenant isolation negative assertion
  (folded into Spec A: another creator's content is NOT offered).
- **Chaos:** not applicable — no retry/fallback behavior in this UI surface.
- **Fuzz:** not applicable — no parser/validator surface here.

## Implementation Units

### Unit 1 — Spec A: provisioned Programming surface (golden path)
**File**: `apps/e2e/tests/creator-programming.spec.ts` (new)
**Story**: `creator-programming-e2e-golden`
**Invariant**: a creator with `manageStreaming` on a provisioned channel can assign their own
content to the pool, see it become queueable (with a "Content" badge), play-next it into the
queue, and never see another creator's content offered.

Auth: `test.use({ storageState: "auth/stakeholder.json" })` (Maya). Navigate via
`contextNav(page, testInfo, "Maya Chen").getByRole("link", { name: "Programming" })` (and/or
`page.goto("/creators/maya-chen/manage/programming")`).

Test cases:
1. **Programming tab renders the real surface** (channel provisioned): the Now Playing / Queue /
   Content Pool headings are present (NOT the "Set up streaming" affordance).
2. **Assign own content to the pool**: `+ Add Content` → `getByLabel("Search content")` → search
   "Studio" → select `Studio Tour 2026` → it appears in the `aria-label="Content pool"` table.
3. **Content is queueable with a "Content" badge**: `+ Add to Queue` → the pool picker
   (`getByLabel("Filter pool items")`) lists the item with a **"Content"** badge
   (`pool-item-picker.tsx:119` — the B1 UI fix; pre-fix content was filtered out).
4. **Play-next queues it (UI assertion)**: select the item → no error banner → the item appears in
   the `aria-label="Upcoming queue"` list.
5. **Cross-tenant isolation**: in `+ Add Content` search, searching for Jordan's "Open Mic" returns
   no results (only Maya's own content + platform library are offered).

**Acceptance**: all 5 cases green against the seeded stack; spec follows the existing
`creator-manage.spec.ts` + `helpers/nav.ts` patterns; pure-UI assertions (no API probes).

### Unit 2 — Spec B: lazy-provisioning path (edge)
**File**: `apps/e2e/tests/creator-programming-provisioning.spec.ts` (new)
**Story**: `creator-programming-e2e-provisioning`
**Invariant**: a creator with NO provisioned channel sees the honest "set up streaming" affordance
on Programming, and creating a stream key provisions the channel so the editorial surface appears.

Uses an **unprovisioned** creator (Jordan or Sam — deliberately left unprovisioned in the seed).
Needs an auth storage-state for that creator (Jordan/Sam are not currently in `global.setup.ts`'s
3 roles — adding one is part of this story; see Risks).

Test cases:
1. **Unprovisioned → setup affordance**: navigate to that creator's `/manage/programming` →
   `getByText("Set up streaming to start programming")` + `getByRole("link", { name: "Go to
   Streaming" })`, NOT the editorial surface.
2. **Create a stream key provisions the channel**: follow the "Go to Streaming" link → create a
   stream key through the Streaming-tab UI → return to Programming → the editorial surface now
   renders (channel was lazy-provisioned by `ensureCreatorChannel`).

**Acceptance**: both cases green; the stream-key creation flow drives real provisioning (asserts
the surface flips from affordance to editorial surface).

## Linked (separate) story — full-pipeline playback infra
**Story**: `creator-channel-engine-e2e-infra` (NOT a child of this feature — standalone, reusable)
Stands up / arms a creator-channel playout engine in the e2e test stack (or routes via S/NC-TV
carry), drives a real publish, and asserts the `track-event → nowPlaying` callback
(`playout-channels.routes.ts:122` → `onTrackStarted` → `/status` now-playing) + HLS manifest
growth. This is the piece that retires the manual AC#5 playback eyeball entirely. Heavier infra;
may itself decompose. This feature's UI specs do NOT depend on it.

## Implementation Order
1. `creator-programming-e2e-golden` (Spec A) — depends on the landed seed (already done).
2. `creator-programming-e2e-provisioning` (Spec B) — independent of Spec A; needs the
   unprovisioned-creator auth fixture.
(Both can run in parallel; neither depends on the other.)

## Test integrity (restated for implementers)
- **Park production bugs, don't hide them.** If a spec fails because the product is genuinely
  broken (not a stale selector), park it via `/agile-workflow:park`, land the failing test with a
  `skip`/`xfail` linked to the backlog id + a one-line reason, and proceed.
- **Fix bad tests in-session.** Drifted selectors / stale fixtures are test debt — repair them.
- **Never game an assertion.** No `expect(true).toBe(true)`, no asserting on whatever the DOM
  happens to render, no deleting a flaky spec without root-causing. A red spec that documents a
  real break beats a green one that lies.

## Risks
- **Spec B needs a new auth fixture.** Jordan/Sam aren't in `global.setup.ts`'s role list. Adding
  one creator-without-channel storage state is part of the provisioning story; keep it minimal
  (one extra login in setup).
- **Stream-key creation UI coupling (Spec B).** Driving provisioning through the Streaming tab
  couples Spec B to that UI. If the Streaming-tab flow is itself flaky/complex, fall back to
  provisioning via a seed/API setup step and assert only the affordance→surface transition.
- **Selector drift.** The grounded selectors are from a read pass; implementers verify against the
  live DOM and fix any drift in-session (test debt, not a bounce).

## Children complete (2026-06-25)
Both child stories `done`: `creator-programming-e2e-golden` (Spec A, all 5 cases green) and
`creator-programming-e2e-provisioning` (Spec B, both cases green). Feature advanced
`implementing → review`.

## Review (2026-06-25)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none

**Summary**: The feature set out to convert the automatable majority of AC#5 into durable Playwright
coverage and carve the infra-bound playback assertion into a separate story. It did exactly that.
Every "Automatable now" AC item has green coverage: Programming surface renders (gated on
`manageStreaming`); creator assigns own content to the pool; content is queueable with the "Content"
badge (the B1 regression guard); play-next queues it; cross-tenant isolation holds; and the
lazy-provisioning path (affordance → stream key → editorial surface) is exercised end-to-end against
real provisioning. The infra-bound real-playback assertion is correctly scoped out as the standalone
`creator-channel-engine-e2e-infra` story (not a child), so the UI coverage shipped without waiting on
heavy test-stack infra.

**Notes**: Deep-lane feature review, inline (no fresh cross-context reviewer spawned — the aggregate
is two already-approved fast-lane stories plus a bug fix that carries its own integration + e2e
verification, all reproduced green this session: full e2e suite `122 passed, 7 skipped`, API unit
`1866 passed`, cross-tenant integration `13 passed`). The mock-boundary deviation (service-stack, not
service-level-mocked) is well-justified and consistent with the 16 preceding specs. Beyond this
feature: AC#5's UI half is now automated coverage; its playback half remains the deferred
`creator-channel-engine-e2e-infra` story plus a one-time manual eyeball, as designed.
