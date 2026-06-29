---
id: gate-docs-readme-e2e-browser-cmd
kind: story
stage: implementing
tags: [documentation]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: docs
created: 2026-06-29
updated: 2026-06-29
---

# Root README e2e browser install command is stale

## Severity
High

## Drift type
readme-stale

## Location
`README.md:216,219`; contradicting: `scripts/dev/install-e2e-browsers.sh:4,17`

## Evidence
The README's test section instructs `bunx playwright install`. The project script now documents on-demand browser installation and runs `bunx playwright install --with-deps chromium`, matching the Chromium-only Playwright projects and dependency install needs. The README's devcontainer paragraph already names the script, but the test section still gives the old command.

## Remediation direction
Replace the e2e setup command in the test section with `bash scripts/dev/install-e2e-browsers.sh`.
