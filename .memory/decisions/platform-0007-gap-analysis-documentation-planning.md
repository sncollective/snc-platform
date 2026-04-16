---
id: platform-0007
title: Gap analysis as the starting point for documentation planning
status: active
created: 2026-03-17
updated: 2026-04-16
supersedes: []
superseded_by: null
revisit_if:
  - "The documentation surface area stabilizes enough that an audit produces the same results repeatedly — at which point maintenance shifts from gap-analysis to continuous drift-detection in the refactor pipeline"
  - "The scan-documentation rule library (established in [platform-0005-jsdoc-inline-documentation.md](platform-0005-jsdoc-inline-documentation.md)) becomes comprehensive enough that gap-analysis as a distinct activity is redundant"
---

## Context

Documentation planning needs a starting point: a list of what to document, prioritized. Two options: (a) guess a backlog from what the team assumes is under-documented, or (b) audit the actual codebase and let real gaps drive the roadmap.

## Decision

Documentation work is scoped from an **agent-driven codebase audit** rather than a guessed backlog. The audit output drives vision and roadmap.

## Consequences

**Better ground-truth.** Actual gaps surface what's missing, what's drift-prone, what's trivial-and-fine. Guessed backlogs conflate "we haven't talked about this" with "this isn't documented."

**Agents do the audit.** Claude Code (or any coding agent) walks the codebase, identifies undocumented exports, unclear intent comments, drifting docs, missing service-layer contracts. Output feeds ROADMAP.md per [platform-0006-backlog-roadmap-archive-lifecycle.md](platform-0006-backlog-roadmap-archive-lifecycle.md).

**Transitions to continuous drift-detection over time.** As the scan-documentation rule library ([platform-0005-jsdoc-inline-documentation.md](platform-0005-jsdoc-inline-documentation.md)) matures, gap-analysis-as-a-project becomes gap-analysis-as-part-of-the-refactor-pipeline. The distinction blurs — which is the revisit trigger.

## Related

- [platform-0005-jsdoc-inline-documentation.md](platform-0005-jsdoc-inline-documentation.md) — the enforcement layer that gap-analysis feeds findings into
- [platform-0006-backlog-roadmap-archive-lifecycle.md](platform-0006-backlog-roadmap-archive-lifecycle.md) — where audit output lands (ROADMAP.md)
- Platform documentation board — `boards/platform/documentation/BOARD.md`
