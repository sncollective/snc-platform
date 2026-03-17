# Platform Skill Conventions

Conventions for skills scoped to the S/NC platform (`platform/.claude/skills/`). All skills use the `platform-` prefix.

---

## Frontmatter Fields

### Required

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | `platform-{action}`. Must match directory name. Exception: library reference skills use `{library}-v{major}` without the `platform-` prefix (e.g., `drizzle-v0`, `hono-v4`). |
| `description` | string | `{WHAT}. {WHEN}.` — drives discovery and auto-triggering. |

### Optional (include only when non-default)

| Field | Type | Default | When to use |
|-------|------|---------|-------------|
| `argument-hint` | string | *(none)* | Workflow skills that take user input |
| `disable-model-invocation` | boolean | `false` | Workflow skills (explicit `/name` only) |
| `user-invocable` | boolean | `true` | `false` for auto-trigger reference skills |
| `allowed-tools` | comma-separated | all | Read-only skills, or security constraints |
| `model` | string | caller's | `sonnet` for fast tasks, `haiku` for trivial |
| `context` | string | `main` | `fork` for long-running analysis |
| `agent` | string | *(none)* | `general-purpose` when using `context: fork` |

---

## Description Examples

From existing platform skills:

| Skill | Description | Pattern |
|-------|-------------|---------|
| `platform-extend` | "Plan and implement new platform features. Use when adding features, fixing bugs, or evolving the platform architecture." | Short WHAT + broad WHEN |
| `platform-refactor` | "Deep-dive codebase analysis to find duplication, consolidation opportunities, and modern best practices. Produces a prioritized refactoring report." | Detailed WHAT + implicit WHEN |
| `platform-patterns` | "Project code patterns and conventions. Auto-loads when implementing, designing, verifying, or reviewing code." | Reference WHAT + auto-trigger WHEN |

---

## Body Patterns

### Workflow (platform-extend, platform-refactor, platform-audit-deps)

```markdown
# Title — Subtitle

[Context sentence]

## Context / Step 1: Load Context
[Read platform/CLAUDE.md, relevant patterns, existing code]

## Step N: [Action]
[Concrete actions, tables for scope decisions]

## Anti-Patterns
- NEVER [common mistake]

## Output / Report
[What to tell the user]
```

Key conventions:
- Reference `platform/CLAUDE.md` for coding standards
- Reference `platform-patterns` skill when touching established code
- Use scope tables when approach varies by input size
- Include anti-patterns for skills that modify code

### Auto-Trigger Reference (platform-patterns)

```markdown
# Title

[What this reference contains]

## [Category]
- [item](file.md) — one-line summary
```

Key conventions:
- SKILL.md is a lightweight index
- Companion files hold the detail
- Categories group related items

### Report/Audit (platform-status, platform-audit-deps)

```markdown
# Title

[Read-only disclaimer]

## Phase 1: [Data Collection]
[Commands to run, files to read]

## Output Format
[Structured template — usually a markdown table]
```

Key conventions:
- Explicitly state read-only constraint
- Define output format precisely
- Use allowed-tools to enforce read-only

---

## File Organization

```
platform/.claude/skills/platform-{name}/
  SKILL.md                  # Always required
  {reference}.md            # When SKILL.md would exceed ~120 lines
  reports/                  # For skills that generate reports (platform-refactor)
  evals/                    # Trigger test cases (auto-trigger/hybrid only)
```

### When to Use Companion Files

| Scenario | Example | Split? |
|----------|---------|--------|
| 30+ patterns to reference | `platform-patterns` | Yes — one file per pattern |
| Research findings | `platform-research-hono-openapi` | Yes — findings.md |
| Workflow under 120 lines | `platform-extend` | No — SKILL.md only |
| Report template | `platform-audit-deps` | No — template inline |

---

## Quality Checklist

### Frontmatter
- [ ] `name` is `platform-{action}` and matches directory
- [ ] Description has WHAT and WHEN
- [ ] Only non-default fields included

### Body
- [ ] References `platform/CLAUDE.md` for coding conventions (if code-touching)
- [ ] References `platform-patterns` where relevant
- [ ] `$ARGUMENTS` used where user input feeds in
- [ ] Concrete file paths, not placeholders
- [ ] Anti-patterns section for code-modifying skills
- [ ] No filler phrases or over-explanation

### Architecture
- [ ] Directory is `platform/.claude/skills/platform-{name}/`
- [ ] Self-contained — works in standalone `snc-platform` repo
- [ ] No dependencies on root-level skills or files outside `platform/`
