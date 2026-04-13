# Claude Tooling — Platform

## Skills (`.claude/skills/`)

**Project conventions:**
- `platform-patterns` — 35+ documented code patterns with examples
- `platform-design-principles` — architectural design principles
- `platform-implementation-principles` — code-level implementation principles

**Scan rule libraries** (used by refactor workflows):
- `scan-stylistic` · `scan-structural` · `scan-quality`
- `scan-performance` · `scan-accessibility` · `scan-documentation` · `scan-seo`
- `security-scan`

**Tech stack references** (auto-load when editing code that touches them):
- Web stack: `hono-v4` · `drizzle-v0` · `zod-v4`
- TanStack: `tanstack-router-v1` · `tanstack-query-v5` · `tanstack-table-v8`
- UI: `ark-ui-v5` · `vidstack-v1`
- Media / streaming: `liquidsoap-v2` · `srs-v6` · `imgproxy-v3`
- Storage / uploads: `garage-v2` · `tusd-v2` · `uppy-tus-v4`
- Platform infra: `pg-boss-v12` · `pino-logging`

## Rules (`.claude/rules/`)

- `platform-patterns.md` — pattern index for quick lookup
- `inline-documentation.md` — JSDoc convention and tier system
- `drizzle-migrations.md` — never hand-write migration SQL; use `drizzle-kit generate`
- `feature-flags.md` — feature flag lifecycle and golden-path implications
- `testing-strategy.md` · `e2e-testing.md` — test surface and golden-path conventions
