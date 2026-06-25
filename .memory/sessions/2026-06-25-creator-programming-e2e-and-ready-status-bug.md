# 2026-06-25 — Creator Programming e2e: drained a real bug, closed the e2e feature, scoped the pixel-eyeball ladder

## What shipped
- **Product bug fixed (`0c24d10`)** — `creator-content-search-excludes-ready-status`. The creator
  "+ Add Content" search + autoFill filtered content on `processing_status = 'completed'`, but
  content's terminal state is `'ready'` (`'completed'` belongs to `PROCESSING_JOB_STATUSES`). So a
  creator's own ready video never surfaced in search. Both call sites in
  `playout-orchestrator.ts` (~909 autoFill, ~1067 searchAvailableContent) now match `'ready' OR
  IS NULL`. **Invisible to every layer above e2e**: typecheck (both columns are strings), unit
  (mocked, fixtures chose passing values), integration (fixtures left status null → hit the
  `IS NULL` arm). The golden e2e exercising real seeded `ready` content caught it first run. The
  integration fixture (`CONTENT_A1_ID`) now sets `processingStatus: "ready"` so the suite exercises
  the arm the product hits.

- **`creator-programming-e2e` feature → done** (both child stories done): Spec A golden (5 cases
  green) + Spec B provisioning. The bug above was caught → parked → drained as one stride, not
  skipped.

## Settled position: e2e shared-state isolation for pool-mutating cases
Assigning content to the pool is a **persistent** shared-DB write, and search hides already-pooled
items (`NOT IN (pool)`), so the 3 search→assign cases collided across runs AND across the two
Playwright projects (`fullyParallel`, one shared DB, Maya the only seed-provisioned creator). The
durable shape (in `creator-programming.spec.ts`):
- The 3 pool-mutating cases run in a separate `describe`, `mode: "serial"`, **chromium-only** (a
  `beforeEach` `test.skip` guard) — assign/queue is backend-scoped + viewport-independent, so one
  project loses no coverage; the dual-render pool view stays dual-project via the read-only surface
  case.
- A `beforeEach` `resetMayaProgramming(page)` drains Maya's queue then pool **via the UI** (no API
  reach-around — preserves the suite's black-box boundary).
- The reset gates on the pool heading's ` (N items)` count before counting remove buttons — that
  parenthetical only renders once the queue-status fetch resolves, so it's the deterministic
  "pool loaded" signal. Counting buttons before rows hydrate reads 0 and skips the drain (this was
  the bug that cost two debug iterations). Remove buttons scoped to the visible dual-render copy via
  `.filter({ visible: true })`.
This mirrors the sibling provisioning spec's "isolate mutations / tolerate prior state" philosophy,
achieved via project-scoping instead of per-creator splitting (Maya is the only provisioned creator).

## Open thread for next session — AC#5 close-out (USER-DIRECTED: held)
`unified-channel-model-creator-enablement` + the `unified-channel-model` epic stay at **`review`**.
AC#5's UI/queue-write half is now green automated coverage; its **playback half** (actual pixels)
still needs a human eyeball — and the user wants to **build the capability to remove that eyeball**
rather than do the manual check. Filed the ladder as backlog:
- `creator-channel-engine-e2e-infra` (already existed, drafting) — **levels 1-2**: machine signals
  (`track-event → nowPlaying` + HLS segment growth). Carries the engine/publisher design fork
  (run a creator engine in the test stack vs route via S/NC-TV carry).
- `e2e-browser-decode-playback-proof` — **level 3**: drive Vidstack, assert `<video>`
  `readyState`/`currentTime` advance (browser actually decoded). Deterministic.
- `e2e-agent-vision-pixel-inspection` — **level 4**: screenshot the frame, a vision agent inspects
  the pixels (literal "agent eyeballs"; also a general visual-debugging capability). Heaviest, least
  deterministic, most broadly useful.
All three depend on the engine+publisher infra; **design the ladder together next session** — the
fork in levels 1-2 determines what 3-4 can assert. Until they land, AC#5's playback rung stays a
one-time manual check and the feature+epic stay at review.

## Notes
- Pre-existing `channel-lifecycle.test.ts` FK failures (3) are unrelated — reproduce on clean HEAD
  with all of this stashed. Were parked twice; **merged this session** into the single
  `channel-lifecycle-creator-profile-seed` backlog item (the duplicate
  `fix-channel-lifecycle-integration-test-seeding` deleted).
- Auth sign-in rate-limits at `windowMs: 60_000, max: 10` (`app.ts:77` `authStrictLimiter`); rapid
  e2e reruns trip 429 in `global.setup.ts`. Wait ~70s, or use `--no-deps` to reuse cached auth.
- `.claude/settings.json` (platform) shows a plugin-marketplace blanking diff — a session/env
  artifact, left unstaged, do not commit.

## End-of-session state
- **Pushed** all 21 unpushed `main` commits to `forgejo` (`8eb05b9..c93e13c`); `main` now in sync
  with `forgejo/main`. (`github` remote is the same s-nc.org URL — one push covers both.)
- **Open follow-ups (deliberately not done):**
  - The **root monorepo's platform submodule pointer** was NOT bumped — root still points at the
    pre-session platform commit. Bump it (`git add platform && commit` at root) when the monorepo
    should track this work.
  - `unified-channel-model-creator-enablement` + the `unified-channel-model` **epic stay at
    `review`** — AC#5's playback rung is the only thing left, and the user chose to build the
    eyeball-removal capability (the L1-4 ladder above) next session rather than do the manual check.
  - `channel-lifecycle-creator-profile-seed` is unresolved backlog (pre-existing FK-seed bug;
    fixture-vs-bug decision pending).
