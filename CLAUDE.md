# Platform CLAUDE.md

@AGENTS.md

## Claude Code specific

- `/release-create` defaults to patch bump of the latest release. Offers minor bump as an alternative.

### Skills (`.claude/skills/`)

- **Work-item lifecycle:** `scope` → `design` → `implement` → `review`; plus `item-park`, `dashboard`.
- **Release + quality gates:** `release-create`, `release-deploy`, and the gate skills `refactor-scan`, `security-scan`, `e2e-triage`, `docs-triage`.
- **Memory / research:** `scan-memory` (cross-tier lint sweep), `research-orchestrator` (ARD v0.1 research engagements), `research-discipline` (the anti-fabrication bundle injected into research sub-agents).
- **Project principles + patterns:** `platform-patterns`, `platform-design-principles`, `platform-implementation-principles`, the `scan-*` rule libraries, and the tech references (`hono-v4`, `drizzle-v0`, etc.).

### Agents (`.claude/agents/`)

- `research-specialist`, `adversarial-reader`, `evaluator` — the ARD verification + fan-out sub-agents (each carries `research-discipline` via `skills:` frontmatter).

### Scripts (`scripts/`)

- `tag-view.py <tag>` — project `.work/active/` + `.work/backlog/` items by tag (supports `--ready` / `--blocked` / `--blocking` dependency queries).
- `scan-memory.py [--face=…]` — mechanical lint sweep over `.memory/` + `.work/` + `.research/`.
- `check-doc-links.py` — markdown-link + boundary validation (also wired into pre-commit).
- `lint-research-claims.py [paths…]` — ARD anchor-and-drift + citation-chain lint over `.research/`.
- `lint-citations.py` — the zero-dependency ARD reference citation-chain lint.

### Auto-loaded rules (`.claude/rules/`)

- **Work-item system:** `item-convention.md`, `item-pipelines.md`, `tag-taxonomy.md`, `document-evolution.md`, `path-conventions.md`.
- **Research band (ARD v0.1):** `research-band-spec.md`, `research-band-catalogs.md`, `research-band-platform.md`.
- **Platform code:** `platform-patterns.md`, `inline-documentation.md`, `drizzle-migrations.md`, `testing-strategy.md`, `e2e-testing.md`.
