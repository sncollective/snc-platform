---
id: gate-docs-missing-ui-patterns
kind: story
stage: done
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

## Implementation (2026-06-29)
- Verified `controlled-confirm-dialog.md` and `responsive-table-dual-render.md` already exist in `.claude/skills/platform-patterns/` and are indexed in both the skill index and digest, so no duplicate files were added for those primitives.
- Added `.claude/skills/platform-patterns/use-polling.md` documenting the shared `usePolling<T>()` pattern, when to use it, required behavior, anti-patterns, and current call sites.
- Added `use-polling` one-line entries to `.claude/skills/platform-patterns/SKILL.md` and `.claude/rules/platform-patterns.md` under the 0.4.0 playout/editorial pattern section.
- Verification: documentation-only change; checked `apps/web/src/hooks/use-polling.ts`, `apps/web/src/routes/live.tsx`, and `apps/web/src/components/playout/editorial-surface.tsx`.

## Review (2026-06-29)

**Verdict**: Approve

**Notes**: Fast-lane (medium gate finding, green verification). Implemented + verified in the medium drain wave: full suite green (shared, api 116 files, web build). No blockers above nit.
