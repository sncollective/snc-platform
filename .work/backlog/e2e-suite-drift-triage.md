---
id: e2e-suite-drift-triage
tags: [testing]
created: 2026-06-11
---

# E2e suite drift triage — ~17/113 failing after the suite became runnable again

The e2e suite was un-runnable from late April to 2026-06-11: the lockfile's
playwright-core (1.59.1) hits an upstream extraction-deadlock on Node 24.16+
(microsoft/playwright #40998), so browsers could never install. With the bump to
^1.60.0 the suite runs again: 96/113 pass; the failures look like app/data drift
accumulated since the tests were last touched (2026-04-24), e.g. strict-mode
violations (`getByText('Maya Chen')` resolves to 2 elements — likely the context-shell
nav redesign), and missing elements on the admin playout page and auth flow.

Triage each failure per test-integrity: stale assertion/fixture → fix the test; real
product regression → its own story. Artifacts in `apps/e2e/test-results/` from the
2026-06-11 run (screenshots + error context per failure).
