---
id: story-integration-test-layer
kind: story
stage: done
tags: [testing]
release_binding: 0.3.0
created: 2026-04-18
updated: 2026-04-18
related_decisions: []
related_designs: []
parent: null
---

# Integration Test Layer

Three-tier testing strategy (`test:unit` / `test:integration` / e2e). Separate `vitest.integration.config.ts` runs against real `.env` + Postgres + Garage. `tests/integration/` with app-boot smoke, health, openapi, and feature-flags tests. Bare `test` script errors with redirect. `.claude/rules/testing-strategy.md` documents the strategy. CLAUDE.md agent commands updated.
