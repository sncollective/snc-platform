# Platform CLAUDE.md

@AGENTS.md

## Claude Code specific

- `/release-create` defaults to patch bump of the latest release. Offers minor bump as an alternative.
- Platform skills live in `.claude/skills/` — `platform-patterns`, `platform-design-principles`, `platform-implementation-principles`, `scan-*` families, tech references (`hono-v4`, `drizzle-v0`, etc.).
- Auto-loaded rules: `.claude/rules/platform-patterns.md`, `.claude/rules/inline-documentation.md`, `.claude/rules/drizzle-migrations.md`, `.claude/rules/testing-strategy.md`, `.claude/rules/e2e-testing.md`.
