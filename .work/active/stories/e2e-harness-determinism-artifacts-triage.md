---
id: e2e-harness-determinism-artifacts-triage
kind: story
stage: done
tags: [testing, developer-experience, e2e-test]
parent: e2e-harness-determinism
depends_on: []
release_binding: 0.4.0
gate_origin: null
created: 2026-06-28
updated: 2026-06-28
---

# E2E harness: artifacts, triage output, and flake policy

## Scope

Make failed e2e runs agent-readable before they become human eyeball work: retain trace/video/screenshot
artifacts, emit a small machine-readable triage summary, and document the flake quarantine/rerun policy.

## Units

- `apps/e2e/playwright.config.ts` — retain video and trace on failure/retry with bounded artifact
  volume; keep screenshots on failure.
- `apps/e2e/tests/helpers/triage.ts` or Playwright reporter hook — write a JSON/Markdown summary that
  names failed tests, artifact paths, error excerpts, and likely next inspection steps.
- `docs/` or `apps/e2e/README.md` — flake policy: rerun cadence, quarantine rules, how to link a
  flaky spec to a work item, and when vision triage is advisory-only.

## Acceptance criteria

- [x] Failed CI/local e2e runs retain trace, screenshot, and video artifacts sufficient for agent
      inspection.
- [x] A machine-readable triage file is emitted under the Playwright output/report tree.
- [x] The flake policy explicitly forbids deleting or weakening tests without root-cause analysis.
- [x] L4 vision inspection is documented as triage/debugging only, not a CI gate.

## Test integrity contract

Real product bugs get parked; stale test fixtures get fixed. A flaky test is quarantined with a reason
and linked work item, never silently deleted or converted into a tautology.

## Implementation notes

- Updated `apps/e2e/playwright.config.ts` to keep trace/video artifacts with `retain-on-failure` and screenshots with `only-on-failure`, keeping retention bounded to failed attempts rather than every passing test.
- Added `apps/e2e/tests/helpers/triage.ts`, a Playwright reporter that writes `test-results/triage.json` and `test-results/triage.md` with failed/flaky test titles, locations, projects, rerun commands, failed retry statuses, error excerpts, and retained artifact paths/inspection steps.
- Added `apps/e2e/README.md` documenting artifact locations, flake rerun/quarantine policy, the prohibition on deleting/weakening tests without root-cause analysis, and L4 vision as triage-only rather than a CI gate.
- Added Node ambient types to `apps/e2e/tsconfig.json` so the e2e config and reporter typecheck under the package config.

## Verification

- `bun install --frozen-lockfile` (restored package workspace dependencies needed for local verification; lockfile unchanged).
- `bunx tsc -p apps/e2e/tsconfig.json --noEmit` — passed.
- `cd apps/e2e && bunx playwright test --list --reporter=list` — passed; listed 129 tests in 20 files.
- `cd apps/e2e && bunx playwright test --list` — passed with configured reporters, validating the custom reporter config loads.

## Review (2026-06-28)

**Verdict**: Approve

**Blockers**: none
**Important**: none
**Nits**: none

**Notes**: Fast-lane story review. Implementation notes record bounded artifact retention, machine-readable triage output, flake policy docs, L4 vision as triage-only, and green e2e config/reporter verification.
