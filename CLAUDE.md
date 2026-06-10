# Platform CLAUDE.md

@AGENTS.md

## Claude Code specific

### Skills (`.claude/skills/`)

- **Work-item lifecycle:** the agile-workflow plugin owns the full pipeline — scope, design,
  implement, review, park, board, release-deploy + the gate family. See the plugin's skill
  surface (`/agile-workflow:scope`, `:feature-design`, `:implement`, `:review`, `:park`,
  `:board`, `:release-deploy`, `:gate-*`).
- **Research:** the agentic-research plugin owns the research engagement surface —
  `/agentic-research:research-orchestrator` dispatches `[research]`-tagged items; lint is the
  plugin's `scripts/lint-citations.py`; query tool is `.research/bin/research-view`.
- **Memory / substrate lint:** `scan-memory` (cross-tier lint sweep over `.memory/` + `.work/`
  + `.research/`).
- **Project principles + patterns:** `platform-patterns`, `platform-design-principles`,
  `platform-implementation-principles`, the `scan-*` rule libraries (`scan-structural`,
  `scan-quality`, `scan-accessibility`, `scan-performance`, `scan-seo`, `scan-documentation`,
  `scan-stylistic`), and the tech references (`hono-v4`, `drizzle-v0`, etc.).

### Agents (`.claude/agents/`)

None — the three research agent definitions (`research-specialist`, `adversarial-reader`,
`evaluator`) were retired when discipline propagation moved to plugin-inline-dispatch. The
plugin's `research-orchestrator` composes role briefs and inlines the discipline bundle into
dispatches.

### Scripts (`scripts/`)

- `scan-memory.py [--face=…]` — mechanical lint sweep over `.memory/` + `.work/` + `.research/`. The `schema` face surfaces `source_class` soft-enum drift.
- `check-doc-links.py` — markdown-link + boundary validation (also wired into pre-commit).

### Auto-loaded rules (`.claude/rules/`)

- **Work-item system:** `document-evolution.md` (carries substrate-before-stance + the
  durability gradient + rules-describe-behavior-directly), `path-conventions.md`,
  `readme-discipline.md` (README authoring; auto-loads on `**/README.md`). Work-item
  structure, stage flow, and tag rubric are plugin-managed — see `.agents/rules/agile-workflow.md`
  and `.work/CONVENTIONS.md`.
- **Research band (ARD v0.5.1, plugin mode):** `.research/CONVENTIONS.md` is the working
  contract. The three bespoke band rules (`research-band-spec.md`, `research-band-catalogs.md`,
  `research-band-platform.md`) are retired — covered by the plugin's vendored kernel.
- **Platform code:** `platform-patterns.md`, `inline-documentation.md`, `drizzle-migrations.md`,
  `testing-strategy.md`, `e2e-testing.md`.
