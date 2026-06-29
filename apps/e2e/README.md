# S/NC e2e suite

The e2e workspace runs Playwright against the local/staging app stack. It is the L3 machine-verifiable gate for browser-visible product behavior.

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
