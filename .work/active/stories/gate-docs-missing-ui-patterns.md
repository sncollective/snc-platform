---
id: gate-docs-missing-ui-patterns
kind: story
stage: drafting
tags: [documentation]
parent: null
depends_on: []
release_binding: 0.4.0
gate_origin: docs
created: 2026-06-29
updated: 2026-06-29
---

# New shared UI primitives are missing from the platform pattern catalog

## Severity
Medium

## Drift type
skill-stale

## Location
`.claude/skills/platform-patterns/SKILL.md:15`; contradicting: `apps/web/src/components/ui/confirm-dialog.tsx:53`, `apps/web/src/components/ui/responsive-table.tsx:79`, `apps/web/src/hooks/use-polling.ts:53`

## Evidence
The pattern catalog's "Available patterns" list has no entries for `ConfirmDialog`, `ResponsiveTable`, or `usePolling`. The bundle introduced reusable primitives now used across admin/creator/simulcast/live/editorial surfaces.

## Remediation direction
Add pattern entries documenting when to use these primitives, required accessibility semantics, and examples from current call sites.
