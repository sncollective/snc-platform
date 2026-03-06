---
name: platform-create-skill
description: Create a new platform skill following repo conventions. Use when the user wants to add, write, or set up a new skill for the platform codebase.
argument-hint: [action-name]
disable-model-invocation: true
---

You are creating a new Claude Code skill scoped to the S/NC platform. The skill will live in `platform/.claude/skills/` with the `platform-` prefix.

## Step 1: Determine Name and Type

Parse $ARGUMENTS to derive the skill name. The full name will be `platform-{action}`.

**Name format:** `platform-{action-verb}` in kebab-case. Good: `platform-migrate`, `platform-debug`. Bad: `platform-the-migrator`, `migrate-platform`.

**Skill type:**

| Type | Frontmatter | When to use |
|------|-------------|-------------|
| **Workflow** | `disable-model-invocation: true` | Interactive guide invoked by `/platform-{name}` |
| **Auto-trigger** | `user-invocable: false` | Background reference loaded automatically |
| **Hybrid** | Both omitted | Can be invoked or auto-triggered |

Existing platform skills for reference:
- Workflow: `platform-extend`, `platform-refactor`, `platform-audit-deps`
- Auto-trigger: `platform-patterns`, `platform-research-hono-openapi`
- Hybrid: `platform-status`

## Step 2: Gather Details

Ask the user (skip questions where the answer is clear from arguments):

1. **What does it do?** One-sentence summary.
2. **When should it trigger?** User intent phrases or auto-trigger context.
3. **Read-only or modifying?** Determines `allowed-tools`.
4. **Fork or main?** Long analysis → `context: fork`. Quick edits → default.
5. **Model tier?** Complex → omit. Fast → `model: sonnet` or `model: haiku`.

## Step 3: Write the Skill

Read `platform-create-skill/platform-skill-conventions.md` for the full conventions spec.

Create `platform/.claude/skills/platform-{name}/SKILL.md`.

**Frontmatter template:**
```yaml
---
name: platform-{name}
description: "{WHAT}. {WHEN}."
# Include only fields that differ from defaults:
# argument-hint: [what the user passes]
# disable-model-invocation: true
# user-invocable: false
# allowed-tools: Read, Glob, Grep
# model: sonnet
# context: fork
# agent: general-purpose
---
```

**Body:** Choose the pattern that fits:
- **Step-by-step workflow** — numbered steps (like `platform-refactor`)
- **Scope-assessment workflow** — classify input, scale approach (like `platform-extend`)
- **Index + reference files** — SKILL.md as index (like `platform-patterns`)
- **Report/audit** — run checks, output structured report (like `platform-status`, `platform-audit-deps`)

Platform skills should reference `platform/CLAUDE.md` for coding conventions and `platform-patterns` for established code patterns where relevant.

**Quality checks before finishing:**
- [ ] `name` matches directory name
- [ ] Description has WHAT and WHEN clauses
- [ ] `$ARGUMENTS` referenced where user input feeds in
- [ ] Steps are concrete actions with real file paths
- [ ] No filler phrases or LLM over-explanation
- [ ] Anti-patterns section if the skill can fail predictably

## Step 4: Create Reference Files (if needed)

Split into companion files when SKILL.md would exceed ~120 lines or reference material is independent of the workflow. See `platform-skill-conventions.md` for guidance.

## Step 5: Report

Tell the user:
- What files were created (full paths)
- How to invoke: `/platform-{name} [args]`
- Suggest a concrete test invocation
