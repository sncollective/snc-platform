# S/NC e2e suite

The e2e workspace runs Playwright against the local/staging app stack. It is the L3 machine-verifiable gate for browser-visible product behavior.

## Deterministic fixtures and clocks

Use `tests/helpers/determinism.ts` for any e2e setup that needs unique fixture names, IDs, tokens, emails, or browser-visible date assertions:

- `stableTestId(testInfo, label, options)` builds a readable deterministic ID with a hash suffix scoped to the Playwright project, title path, repeat index, and parallel worker slot.
- `seededSuffix(seed)` / `testSeededSuffix(testInfo, ...parts)` replace `Date.now()` and `Math.random()` in fixture names.
- `E2E_FIXED_FIXTURE_TIMESTAMP_ISO` is the canonical explicit timestamp for backend fixture rows.
- `installFixedClock(page)` freezes browser-visible `Date.now()` / `new Date()` for specs that assert dates or relative time. Call it before `page.goto()`; it affects only the Playwright browser context and does not force production services to use a test clock.

Prefer explicit IDs and timestamps in test-control/setup payloads. Product assertions should stay browser-facing; deterministic helpers are for setup and for date/time assertions that would otherwise depend on wall-clock time.

## Failure artifacts and triage

Playwright keeps artifacts only for failing tests, so artifact volume remains bounded by the number of failures rather than by the whole suite:

- trace: `retain-on-failure`
- screenshot: `only-on-failure`
- video: `retain-on-failure`

Each run also writes agent-readable triage files under `apps/e2e/test-results/`:

- `triage.json` — machine-readable failed/flaky test summary with locations, retry attempts, artifact paths, error excerpts, and rerun commands.
- `triage.md` — the same information formatted for quick human review.

Start failure work from the triage file, then open the retained trace/video/screenshot before asking a human to eyeball the app.

## Flake quarantine and rerun policy

A flaky spec is a product-quality signal, not a reason to weaken the gate.

1. Rerun the named test from `test-results/triage.json` once locally to distinguish deterministic failure from transient infrastructure noise.
2. If CI failed and the local rerun passes, rerun the CI job once. Do not merge on repeated unexplained flakes.
3. If a spec is flaky, quarantine it only with an explicit reason and a linked `.work` item. The quarantine note must name the observed failure mode and the planned root-cause path.
4. Never delete a spec, loosen an assertion, convert it to a tautology, or expand timeouts blindly without root-cause analysis.
5. Product bugs discovered during triage are parked/scoped as work items. Stale fixtures, drifted selectors, and bad mocks are fixed in-session so the suite remains meaningful.

## L4 vision policy

Vision inspection is advisory triage/debugging only. It may inspect retained screenshots or videos to help explain a failure, especially for visual regressions, but it is not a CI gate and must not replace deterministic Playwright assertions. The e2e suite remains the hard machine-verifiable gate; vision output is evidence for the agent or human doing failure analysis.
