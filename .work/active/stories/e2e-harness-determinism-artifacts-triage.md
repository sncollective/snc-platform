---
id: e2e-harness-determinism-artifacts-triage
kind: story
stage: implementing
tags: [testing, developer-experience, e2e-test]
parent: e2e-harness-determinism
depends_on: []
release_binding: null
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

- [ ] Failed CI/local e2e runs retain trace, screenshot, and video artifacts sufficient for agent
      inspection.
- [ ] A machine-readable triage file is emitted under the Playwright output/report tree.
- [ ] The flake policy explicitly forbids deleting or weakening tests without root-cause analysis.
- [ ] L4 vision inspection is documented as triage/debugging only, not a CI gate.

## Test integrity contract

Real product bugs get parked; stale test fixtures get fixed. A flaky test is quarantined with a reason
and linked work item, never silently deleted or converted into a tautology.
