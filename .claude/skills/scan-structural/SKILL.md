---
name: scan-structural
description: >
  Project structural organization rules for the SNC platform (Hono API + TanStack Start + pnpm monorepo).
  Proactively scans for organizational issues and produces a prioritized backlog.
  Defines the team's preferred file, folder, and module structure.
allowed-tools: Read, Glob, Grep, Bash, Agent, Write
---

# Structural Refactor

Scan the codebase for organizational issues based on these structural rules.
Each rule has a reference file with rationale, examples, and exceptions.

## Rules

| Rule | Summary | Reference |
|------|---------|-----------|
| route-file-size | Route files target ≤400 lines; over 600 must be split | [details](references/route-file-size.md) |
| thin-handlers | Route handlers parse/validate/delegate/respond; business logic lives in services/ | [details](references/thin-handlers-fat-services.md) |
| route-utils-separation | Shared route utilities live in src/lib/, not alongside *.routes.ts files | [details](references/route-utilities-separation.md) |
| component-splitting | Split components by structural concern (sections, tangled state), not line count | [details](references/component-splitting-by-concern.md) |
| one-domain-schema | Each domain gets exactly one schema file in @snc/shared | [details](references/one-domain-schema-per-file.md) |
| flat-services | Services folder stays flat until it exceeds ~15 files | [details](references/flat-services-directory.md) |
| test-mirror | Tests live in a parallel tests/ tree mirroring src/ structure | [details](references/test-mirror-structure.md) |

## Output

Write the refactoring backlog to `docs/structural-refactor-backlog.md` in the platform directory.

The document should be a **prioritized refactoring backlog** with three tiers:

### High Value
Structural changes that significantly improve navigability, maintainability, or developer
onboarding with low risk. Each entry:
- **Files**: affected paths
- **Rule**: which structural rule is violated
- **Current**: actual directory/file layout
- **Target**: proposed reorganization
- **Implementation Notes**: migration concerns, import updates
- **Acceptance Criteria**: `[ ]` testable assertions

### Worth Considering
Valid reorganizations with moderate impact or moderate effort. Include rationale.

### Not Worth It
Code that technically violates a structural rule but should NOT be reorganized. Include WHY:
too many dependents, churn outweighs benefit, the current structure has reasons that still apply.
