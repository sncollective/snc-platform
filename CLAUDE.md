# Platform CLAUDE.md

@AGENTS.md

## Claude Code specific

- `/release-create` defaults to patch bump of the latest release. Offers minor bump as an alternative.

### Skills (`.claude/skills/`)

- **Work-item lifecycle:** `scope` → `design` → `implement` → `review`; plus `item-park`, `dashboard`.
- **Release + quality gates:** `release-create`, `release-deploy`, and the gate skills `refactor-scan`, `security-scan`, `e2e-triage`, `docs-triage`.
- **Memory / research:** `scan-memory` (cross-tier lint sweep). Research engagements run through the agentic-research plugin's `research-orchestrator` skill; lint is the plugin's `scripts/lint-citations.py`; query tool is `.research/bin/research-view`.
- **Project principles + patterns:** `platform-patterns`, `platform-design-principles`, `platform-implementation-principles`, the `scan-*` rule libraries, and the tech references (`hono-v4`, `drizzle-v0`, etc.).

### Agents (`.claude/agents/`)

None — the three research agent definitions (`research-specialist`, `adversarial-reader`, `evaluator`) were retired when discipline propagation moved to plugin-inline-dispatch (2026-06-10). The plugin's `research-orchestrator` composes role briefs and inlines the discipline bundle into dispatches.

### Scripts (`scripts/`)

- `tag-view.py <tag>` — project `.work/active/` + `.work/backlog/` items by tag (supports `--ready` / `--blocked` / `--blocking` dependency queries).
- `scan-memory.py [--face=…]` — mechanical lint sweep over `.memory/` + `.work/` + `.research/`. The `schema` face surfaces `source_class` soft-enum drift.
- `check-doc-links.py` — markdown-link + boundary validation (also wired into pre-commit).

**Retired research scripts** (replaced by the agentic-research plugin): `reference-tag-view.py` (→ `.research/bin/research-view --tags`), `audit-handles.py` (→ plugin lint `--stats`), `lint-research-claims.py` and `lint-citations.py` shim (→ plugin's `scripts/lint-citations.py`).

### Auto-loaded rules (`.claude/rules/`)

- **Work-item system:** `document-evolution.md` (carries substrate-before-stance + the durability gradient + rules-describe-behavior-directly), `path-conventions.md`, `readme-discipline.md` (README authoring; auto-loads on `**/README.md`). Work-item structure, stage flow, and tag rubric are now plugin-managed — see `.agents/rules/agile-workflow.md` and `.work/CONVENTIONS.md`.
- **Research band (ARD v0.5.1, plugin mode):** `.research/CONVENTIONS.md` is the working contract. The three bespoke band rules (`research-band-spec.md`, `research-band-catalogs.md`, `research-band-platform.md`) have been retired — covered by the plugin's vendored kernel.
- **Platform code:** `platform-patterns.md`, `inline-documentation.md`, `drizzle-migrations.md`, `testing-strategy.md`, `e2e-testing.md`.
