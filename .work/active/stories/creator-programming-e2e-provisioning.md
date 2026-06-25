---
id: creator-programming-e2e-provisioning
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

# Spec B — lazy channel-provisioning path

Unit 2 of `creator-programming-e2e`. Independent of Spec A (golden). Exercises the
unprovisioned-creator path the seed deliberately keeps open (Jordan + Sam have no channel).

## Scope
**File**: `apps/e2e/tests/creator-programming-provisioning.spec.ts` (new) + a new auth storage-state
for an unprovisioned creator in `apps/e2e/global.setup.ts`.

**Invariant**: a creator with NO provisioned channel sees the honest "set up streaming" affordance
on Programming, and creating a stream key provisions the channel so the editorial surface appears.

Uses an UNPROVISIONED creator (Jordan `jordan-ellis` or Sam `sam-okafor`). They are not in
`global.setup.ts`'s 3 current roles, so add one creator-without-channel storage state (one extra
login in setup — keep minimal).

Test cases:
1. Unprovisioned → navigate to that creator's `/manage/programming` →
   `getByText("Set up streaming to start programming")` + `getByRole("link", { name: "Go to
   Streaming" })`, NOT the editorial surface.
2. Create a stream key via the Streaming-tab UI → return to Programming → the editorial surface now
   renders (channel lazy-provisioned by `ensureCreatorChannel`).

## Acceptance
- [ ] Both cases green; the affordance→surface transition is asserted (real provisioning, not mocked).
- [ ] New unprovisioned-creator auth fixture added to `global.setup.ts` (minimal).
- [ ] Run: `bun run --filter @snc/e2e test -- creator-programming-provisioning.spec.ts`.

## Risks / fallback
If the Streaming-tab stream-key UI is flaky or heavy to drive, fall back to provisioning via a
seed/API setup step and assert only the affordance→surface transition (case 1 + a provisioned-state
assertion), and note the reduced coverage. Don't let a flaky Streaming-tab dependency make this spec
unreliable.

## Test integrity
Park genuine product bugs (don't hide); fix drifted selectors/fixtures in-session; never game an
assertion green. A red spec documenting a real break beats a green one that lies.

## Implementation notes

- **Files changed:**
  - `apps/e2e/tests/creator-programming-provisioning.spec.ts` (new) — the spec.
  - `apps/e2e/global.setup.ts` — added one extra login → `auth/creator-unprovisioned.json`.
  - `apps/e2e/fixtures/test-users.ts` — added `USERS.jordan` (Jordan Ellis, `jordan-ellis`,
    `jordan@snc.demo`, password123, owner of his own profile, seed-unprovisioned).
- **New auth fixture:** `auth/creator-unprovisioned.json` (Jordan). Auth states are gitignored
  (`.gitignore`: `apps/e2e/auth/*.json`), so the JSON is not committed — `global.setup.ts` mints
  it. The existing setup reuses a single `request` context across logins and snapshots after each;
  appending Jordan as the 4th/last login captures his session cookie into the new state, matching
  the established pattern.
- **Cases covered (both green, chromium + mobile):**
  1. **Unprovisioned → setup affordance** — navigate to `jordan-ellis`'s `/manage/programming`,
     assert `"Set up streaming to start programming"` + the `"Go to Streaming"` link are visible,
     and the editorial-surface headings (`Now Playing` / `Queue` / `Content Pool`) have count 0.
  2. **Create a stream key provisions the channel** — drive the Streaming-tab key-create UI, assert
     the success status banner, return to Programming via context nav, assert the editorial surface
     now renders (all three headings visible) and the affordance is gone.
- **Did NOT take the fallback.** Kept the real provisioning path (creating a stream key through the
  Streaming-tab UI, which lazy-provisions via `createStreamKey` → `ensureCreatorChannel`,
  `apps/api/src/services/stream-keys.ts:89`). The Streaming-tab flow proved drivable
  deterministically once two timing/isolation issues were handled (below).
- **State-isolation design (grounded, deviation from the one-creator sketch in Scope):** provisioning
  is a persistent one-way change against the shared seed DB, and both Playwright projects
  (chromium + mobile) hit the same backend with no per-project reseed. So the spec splits the two
  unprovisioned creators the seed leaves open:
  - Case 1 reads **Jordan** and never mutates him → the "unprovisioned" assertion holds in both
    projects regardless of run order.
  - Case 2 provisions **Sam** (`sam-okafor`) — a creator no test asserts unprovisioned — so mutating
    him in both projects / on re-runs is harmless. Case 2 is tolerant of Sam already being
    provisioned (asserts the real affordance→surface transition on a fresh DB; asserts the
    surface-renders invariant unconditionally). Case 2 authenticates as **admin** (`auth/admin.json`),
    which bypasses the creator-membership gate and gets owner-level permissions, so it can drive
    Sam's Streaming + Programming surface without minting a third per-creator auth state.
- **Hydration-timing guard (test debt, not a product bug):** reaching the Streaming tab via the
  client-side affordance `<Link>` lands on a form that remounts once its `loadKeys` effect settles,
  which can wipe a value filled too early (the create button stays disabled because React's
  controlled `newKeyName` never sees the value). Wrapped the fill in a Playwright web-first
  `expect(async () => { fill; toHaveValue; toBeEnabled }).toPass()` retry so it re-fills until the
  value sticks and the button enables. A real user typing after the page settles sees the button
  enable normally — confirmed in isolation.
- **Assertion layer:** pure-UI only, no `page.request` / API probes from the test body (matches the
  suite's black-box boundary; `request` lives only in `global.setup.ts`).
- **Adjacent issues parked:** none.
- **Verification:** `bun run --filter @snc/e2e test -- creator-programming-provisioning.spec.ts`
  → 5 passed (setup + case 1 ×2 projects + case 2 ×2 projects), exit 0. Typecheck clean
  (`tsc --noEmit` on `apps/e2e`). Note: the auth sign-in endpoint rate-limits under rapid repeated
  setup runs (429 on `global.setup.ts`) — a setup-harness flake from iterating, unrelated to the
  spec; the clean run after the limiter cleared is green. Re-confirmed green in the full-suite run
  this session (`122 passed, 7 skipped`).

## Review (2026-06-25)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none

**Notes**: Fast-lane story review. Verification green and re-confirmed in this session's full e2e
suite (`122 passed, 7 skipped`). The state-isolation design (Jordan read-only for the unprovisioned
assertion, Sam mutated-and-tolerant via admin auth) is sound and is the pattern the golden spec's
isolation later mirrored. Did not take the documented fallback — drove the real stream-key
provisioning path. Parent feature `creator-programming-e2e` stays active.
