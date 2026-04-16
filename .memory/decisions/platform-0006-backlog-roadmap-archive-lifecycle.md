---
id: platform-0006
title: BACKLOG → ROADMAP → ARCHIVE lifecycle for platform documentation planning
status: active
created: 2026-03-17
updated: 2026-04-16
supersedes: []
superseded_by: null
revisit_if:
  - "The board pipeline system fully replaces the ROADMAP.md / ARCHIVE.md pattern — at which point this convention becomes legacy and the files themselves should be rethought or retired"
  - "The items-tier trial resolves in a direction that absorbs ROADMAP/ARCHIVE into structured item state (state transitions on items rather than file-per-lifecycle-stage)"
---

## Context

Platform documentation planning needed a lightweight lifecycle for tracking which roadmap phases are active, which are done, and which are planned. The question was whether to accumulate all history in a single ROADMAP.md, split into multiple files by state, or use the board pipeline system directly.

## Decision

Completed roadmap phases move from `ROADMAP.md` to `ARCHIVE.md` once done. `BACKLOG.md` holds unplanned / future phases; `ROADMAP.md` holds active planning; `ARCHIVE.md` holds completed history.

## Consequences

**Keeps the roadmap focused on active work.** ROADMAP.md stays scannable because it doesn't carry completed history.

**Archive preserves history without inflating agent context.** Agents loading ROADMAP.md on every session don't pay the cost of reading historical phases. Anyone wanting the history opens ARCHIVE.md explicitly or walks git history.

**Pattern overlaps with board-convention ARCHIVE lifecycle.** The 2026-04-14 [board-convention.md](../../../.claude/rules/board-convention.md) §Archive lifecycle codifies a similar pattern for kanban boards (fresh `[x]` inline → aged-out `ARCHIVE.md` → periodic trim). This doc lifecycle predates that convention; they're similar in spirit, different in domain (doc planning vs. board items).

**Revisit tied to the items-tier decision.** If the items-tier trial (see [.memory/research/agent-memory-co-development.md Position 9 partial resolution](../../../.memory/research/agent-memory-co-development.md)) resolves in a direction that captures state transitions as item frontmatter rather than file-per-lifecycle, this lifecycle pattern likely folds into that — and the ROADMAP/ARCHIVE files retire.

## Related

- Platform documentation board — `boards/platform/documentation/BOARD.md`
- [.claude/rules/board-convention.md](../../../.claude/rules/board-convention.md) §Archive lifecycle — analogous pattern for board items
