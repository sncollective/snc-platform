---
id: idea-consolidate-claude-skills-to-agents
created: 2026-06-29
updated: 2026-06-29
tags: [developer-experience, refactor]
---

# Consolidate `.claude/` skills/rules/patterns into `.agents/` (no longer using Claude Code)

Operator no longer uses Claude Code, so `.claude/` is a confusingly-named convention
directory. Consolidate to `.agents/` (the agent-neutral location the agile-workflow
plugin + gate skills already expect as source-of-truth).

## Current state (captured 2026-06-29 mid-0.4.0-gate)

- `.claude/rules/` (8 files) — force-loaded rules incl. `platform-patterns.md` digest,
  `drizzle-migrations.md`, `e2e-testing.md`, `path-conventions.md`, etc. Referenced by
  AGENTS.md.
- `.claude/skills/` (26 dirs) — 8 `scan-*` rule libs + 17 tech-ref libs (hono-v4,
  drizzle-v0, etc.) + `platform-patterns` (38 pattern files after the 0.4.0 gate added 7).
  Actively load-bearing: the refactor gate loads `scan-*` from here; the patterns gate
  writes patterns + the digest here.
- `.claude/commands/`, `.claude/output-styles/`, `.claude/settings*.json` — Claude-Code-
  specific, unused by other agents. Dead weight.
- `.claude/worktrees/` (2 dirs) — full duplicated repo copies with stale
  `.research/`/`.work/`/`.claude/` trees. Pure cruft, inflating repo footprint (relevant
  to the recurring disk-full condition).
- `.agents/rules/` — plugin-managed agile-workflow rules block (live).
- `.agents/skills/` — **empty** (fossil of an incomplete prior migration).

## Why deferred from 0.4.0

Doing it mid-quality-gate is wrong-timed: the 6 gates are entangled with the `.claude/`
layout (refactor gate loads `scan-*` from `.claude/skills/`; patterns gate writes to
`.claude/skills/platform-patterns/` + `.claude/rules/platform-patterns.md`; 3 gate-finding
items cite `.claude/` paths; `scan-quality/references/pattern-compliance.md` hardcodes
`{project}/.claude/skills/platform-patterns/SKILL.md`). Moving mid-release = re-pointing all
of that under deadline pressure.

## Target shape (for scope time)

- `.claude/rules/` → `.agents/rules/` (consolidate with plugin rules block; one rules location)
- `.claude/skills/{scan-*,tech-refs,platform-patterns}` → `.agents/skills/` (one skills location;
  this is where gate-patterns *expects* patterns to live)
- `.claude/{commands,output-styles,settings*,worktrees}` → deleted (Claude-specific, unused)

## How to execute (for scope time)

Run as an `/agile-workflow:convert --update` pass — it's built to detect path moves and
rewrite inbound references safely ("checks inbound references before moving any path and
rewrites or shims them"). Low risk post-release: inbound-ref count is small (~3 docs/AGENTS/
CONVENTIONS files + 1 hardcoded scan-quality path + the 3 gate findings — all mechanical).

## Cheap win doable anytime (no reorg needed)

Delete `.claude/worktrees/` (2 dirs) — pure cruft, unreferenced, frees disk. Safe, isolated,
doesn't touch load-bearing skills/rules. Could be done before the full reorg lands.
