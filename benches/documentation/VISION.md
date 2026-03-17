# Platform Documentation

## Overview

A structured set of feature and architecture docs that give contributors, operators, and AI agents the context they need to work with and run the S/NC platform. Human-facing guides live in `platform/docs/`, agent-facing context supplements the existing `.claude/` files, and a roadmap drives implementation.

## Problem Statement

The platform has 12 feature domains with zero or partial documentation. Human contributors reverse-engineer how features work from source code. Agents rely on CLAUDE.md and pattern files, which cover conventions but not domain logic, data flows, or operational details. This slows both audiences down and increases the risk of incorrect assumptions.

## Solution

- **Human-facing docs** in `platform/docs/`: feature guides covering what each domain does, how it works, key workflows, and operational details.
- **Agent-facing docs** in `platform/.claude/`: structured context files that give agents domain knowledge — schemas, relationships, decision rationale — supplementing (not duplicating) what's already in CLAUDE.md and pattern files.
- **Shared source where possible.** Where audiences diverge, maintain separate artifacts rather than forcing one doc to serve both.

## Usage

- **Contributors** find the relevant feature guide in `platform/docs/` when picking up work in an unfamiliar domain. Understand the data model, key flows, and integration points before writing code.
- **Operators** reference operational docs (auth setup, seeding, admin workflows) when deploying or managing the platform.
- **Agents** automatically pick up domain context from `.claude/` files when working on tasks — loaded via hierarchical config, same as pattern files today.
- **Roadmap as work tracker.** Gaps land in BACKLOG.md, get prioritized into ROADMAP.md as phased deliverables, and agents or humans implement them. Completed phases move to ARCHIVE.md to keep the roadmap lean.

## Architecture

| Location | Purpose | Audience |
|----------|---------|----------|
| `platform/docs/` | Feature and operational guides | Humans |
| `platform/.claude/` (rules/skills) | Domain context, supplementing existing conventions and patterns | Agents |
| `platform/projects/documentation/` | Project management (vision, roadmap, backlog, decisions, archive) | Both |
| `platform/projects/refactor/` | Relocated refactor archive | Both |

Document lifecycle:

```
BACKLOG  →  ROADMAP  →  ARCHIVE
(gaps)      (active)    (completed)
```

Gaps are captured in BACKLOG.md, prioritized into ROADMAP.md as phased deliverables, implemented by agents or humans, and completed phases move to ARCHIVE.md. This keeps the roadmap focused on active work and avoids loading completed items into agent context.

## Success Criteria

- Every domain in the backlog (all 12 items) has documentation for at least one audience.
- A new contributor can go from clone to running the platform and understanding a feature domain without reading source code.
- An agent working in a feature area has enough loaded context to make correct assumptions about data models and flows without exploratory code reads.
- No duplication between `docs/` guides and `.claude/` context — each doc has a clear audience and purpose.
- Refactor archive relocated to `platform/projects/refactor/`, old paths cleaned up.
- BACKLOG.md reflects current state as items are completed.
