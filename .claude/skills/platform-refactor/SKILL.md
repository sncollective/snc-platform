---
name: platform-refactor
description: "Full refactor pipeline: analyze a scope, implement findings interactively, then validate and archive. Use when you want to run the complete plan-fix-validate cycle for a codebase area."
argument-hint: [scope — e.g., "middleware", "routes"] or omit for full sweep
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash, Edit, Write, AskUserQuestion, Agent, Task
model: sonnet
---
# Refactor — Pipeline Orchestrator

You run the full refactor pipeline for a scope (or all scopes): plan → fix → validate. You use the Agent tool to launch each phase as a subagent with its own context window.

## Arguments

$ARGUMENTS

- **With scope** (e.g., `middleware`): Run the single-scope pipeline for that scope.
- **Without arguments**: Full sweep — discover all scopes, let the user choose which to run.

## Sub-Skills

The pipeline has three phases, each defined by its own SKILL.md:

| Phase | Skill file | Role |
|-------|-----------|------|
| Plan | `platform/.claude/skills/platform-refactor-plan/SKILL.md` | Generate analysis report |
| Fix | `platform/.claude/skills/platform-refactor-fix/SKILL.md` | Implement one finding |
| Validate | `platform/.claude/skills/platform-refactor-validate/SKILL.md` | Test, regression check, archive |

To launch a phase, read the sub-skill's SKILL.md and pass its full content as the Agent tool's `prompt` parameter, with the specific arguments appended.

## Single-Scope Pipeline

When `$ARGUMENTS` contains a scope:

### Phase 1: Plan

1. Check if a report already exists at `platform/.claude/skills/platform-refactor-plan/reports/refactor-{scope}.md`.
   - If it exists, ask the user: **use existing report** or **regenerate**?
   - If regenerating, proceed below. If using existing, skip to Phase 2.
2. Read `platform/.claude/skills/platform-refactor-plan/SKILL.md`.
3. Launch an Agent with the skill content as prompt, appending the scope as `$ARGUMENTS`. Use `subagent_type: "general-purpose"`.
4. Confirm the report was created.

### Phase 2: Fix

1. Read the report at `platform/.claude/skills/platform-refactor-plan/reports/refactor-{scope}.md`.
2. Extract the **Suggested Implementation Order** section to get the ordered list of findings.
3. Read `platform/.claude/skills/platform-refactor-fix/SKILL.md` (read once, reuse for each finding).
4. For each finding in order, present it to the user with three options:
   - **Implement**: Launch an Agent with the fix skill content as prompt, passing `{scope} {finding-id}` as arguments.
   - **Skip**: Move to the next finding.
   - **Stop**: Halt the pipeline and tell the user where they left off (which finding, how many remain).
5. After each implementation, briefly report the result before moving to the next finding.

### Phase 3: Validate

1. Read `platform/.claude/skills/platform-refactor-validate/SKILL.md`.
2. Launch an Agent with the validate skill content as prompt, passing the scope as arguments.
3. Report the validation results to the user.

### Pipeline Summary

After all phases complete, summarize:
- Findings: total / implemented / skipped
- Test results from validation
- Whether the report was archived

## Full Sweep (No Arguments)

When `$ARGUMENTS` is empty:

### Step 1: Discover Scopes

Read `platform/.claude/skills/platform-refactor-plan/SKILL.md` and extract the scope keyword table from Step 2. This is the single source of truth for available scopes.

Present the scope list to the user. Let them:
- Select which scopes to include (default: all keyword scopes, not file paths or concepts)
- Confirm or reorder

### Step 2: Iterate

For each selected scope:
1. Run the single-scope pipeline (Phase 1 → 2 → 3).
2. After each scope completes, ask the user: **continue to next scope** or **stop here**?

### Step 3: Final Summary

After all scopes (or when the user stops), report:
- Scopes completed vs. remaining
- Total findings across all scopes: implemented / skipped
- Any scopes that had test failures during validation

## Anti-Patterns

- **NEVER run phases out of order** — plan must complete before fix, fix before validate
- **NEVER implement findings without user approval** — always present each finding and wait for implement/skip/stop
- **NEVER skip the validate phase** — if any findings were implemented, validation must run
- **NEVER call sub-skills as `/skill` invocations** — use the Agent tool with the skill's SKILL.md content as the prompt
- **NEVER combine the orchestrator with implementation** — this skill coordinates, it does not modify application code directly
