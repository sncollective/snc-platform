---
id: docs-ux-decisions-stale-boards-path
kind: backlog
tags: [documentation]
created: 2026-06-12
---

# Docs drift: ux-decisions.md Decision Lifecycle step 3 points at retired `boards/` tier

## Description

`docs/ux-decisions.md:61` (Decision Lifecycle step 3) says design decisions are
captured "on the board (`boards/.../design/`)". No `boards/` directory exists —
decisions live in the work-item body (item-IS-the-work, agile-workflow
substrate), which is exactly how the streaming-playout-ux-review go/no-go was
actually conducted and recorded.

## Fix

Rewrite step 3 to point at the work-item body in `.work/` as the decision
record. One-line doc fix.

## Origin

Review of `streaming-playout-ux-review` (2026-06-12). The review process matched
the framework's collaboration model faithfully; the drift is in the doc, not the
conduct.
