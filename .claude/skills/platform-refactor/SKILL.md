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

| Phase    | Skill file                                           | Role                            |
| -------- | ---------------------------------------------------- | ------------------------------- |
| Plan     | `.claude/skills/platform-refactor-plan/SKILL.md`     | Generate analysis report        |
| Fix      | `.claude/skills/platform-refactor-fix/SKILL.md`      | Implement one finding           |
| Validate | `.claude/skills/platform-refactor-validate/SKILL.md` | Test, regression check, archive |

To launch a phase, read the sub-skill's SKILL.md and pass its full content as the Agent tool's `prompt` parameter, with the specific arguments appended.

## Single-Scope Pipeline

When `$ARGUMENTS` contains a scope:

### Phase 1: Plan

1. Check if a report already exists at `docs/refactor/refactor-{scope}.md`.
   - If it exists, ask the user: **use existing report** or **regenerate**?
   - If regenerating, proceed below. If using existing, skip to Phase 2.
2. Check if an archived report exists at `docs/refactor/archive/refactor-{scope}.md`.
   - If found, note it — the plan agent's Step 0 will read it and exclude already-implemented findings.
3. Read `.claude/skills/platform-refactor-plan/SKILL.md`.
4. Launch an Agent with the skill content as prompt, appending the scope as `$ARGUMENTS`. Use `subagent_type: "general-purpose"`.
5. Confirm the report was created.

### Phase 2: Fix

1. Read the report at `docs/refactor/refactor-{scope}.md`.
2. Extract the **Suggested Implementation Order** section to get the ordered list of findings.
3. Read `.claude/skills/platform-refactor-fix/SKILL.md` (read once, reuse for each finding).
4. Auto-continue through findings sequentially — do NOT prompt the user for each finding. For each finding in order:
   - Launch an Agent with the fix skill content as prompt, passing `{scope} {finding-id}` as arguments.
   - After the agent completes, briefly report the result (finding ID, pass/fail, files changed).
   - Continue immediately to the next finding.
5. Only pause the pipeline when:
   - A fix agent reports a **test failure** — show the failure and ask the user how to proceed.
   - A fix agent uses **AskUserQuestion** — it needs a decision (e.g., Option A vs B).
   - The agent itself hits an **error** — report it and ask whether to skip or stop.
6. The user can always interrupt naturally (Ctrl+C or deny a tool call).

### Phase 3: Validate

1. Read `.claude/skills/platform-refactor-validate/SKILL.md`.
2. Launch an Agent with the validate skill content as prompt, passing the scope as arguments.
3. Report the validation results to the user.

### Pipeline Summary

After all phases complete, summarize:

- Findings: total / implemented / failed
- Test results from validation
- Whether the report was archived
- Backlog items saved: P3 findings / best practices / OSS alternatives deferred to `docs/refactor/backlog.md`

## Full Sweep (No Arguments)

When `$ARGUMENTS` is empty:

### Context Window Warning

A full sweep across all scopes will exhaust the orchestrator's context window. Each scope generates a Plan summary, N Fix summaries (one per finding), and a Validate summary — all of which accumulate here. Running more than **2-3 scopes** in a single conversation risks context compression losing details the orchestrator needs for tracking and the final summary.

**Default behavior**: Present scopes, let the user pick **1-3** to run now. Suggest continuing remaining scopes in a new conversation.

### Step 1: Discover Scopes

Read `.claude/skills/platform-refactor-plan/SKILL.md` and extract the scope keyword table from Step 2. This is the single source of truth for available horizontal layer scopes.

Check `docs/refactor/archive/` for archived reports. For each archived report, note the scope and `**Archived**` date. When presenting scopes, mark recently refactored ones (e.g., "middleware — last refactored 2026-03-01") so the user can deprioritize them.

**Dynamic domain discovery** — detect available vertical slices from the file system:

1. Glob `packages/shared/src/*.ts` to find shared schema files
2. Glob `apps/api/src/routes/*.routes.ts` to find API route files
3. Intersect the basenames (stripping `.routes.ts` / `.ts`) — any name appearing in both is a domain with a vertical slice available
4. Exclude known non-domain files (`index`, `errors`, `result`, `auth`, `storage`, `storage-contract`) from the shared glob results

Present both groups to the user:

```
Horizontal layers: routes, components, lib, hooks, tests, shared, middleware, styles

Vertical slices (auto-detected): booking, content, creator, dashboard, merch, subscription
```

Recommend selecting **1-3 scopes per session**. The user can pick from either group. Let them:

- Select which scopes to include (recommend 1-3; warn if they select more)
- Confirm or reorder

### Step 2: Iterate

For each selected scope:

1. Run the single-scope pipeline (Phase 1 → 2 → 3).
2. Briefly report the scope result, then continue immediately to the next scope.
3. Only pause if a scope had test failures or errors — otherwise keep going.

### Step 3: Final Summary

After all scopes (or when the user stops), report:

- Scopes completed vs. remaining
- Total findings across all scopes: implemented / skipped
- Any scopes that had test failures during validation
- Backlog totals: P3 findings / best practices / OSS alternatives saved across all scopes

## Anti-Patterns

- **NEVER run phases out of order** — plan must complete before fix, fix before validate
- **NEVER pause for approval on passing findings** — auto-continue unless there is a test failure, an error, or the fix agent asks a question
- **NEVER skip the validate phase** — if any findings were implemented, validation must run
- **NEVER call sub-skills as `/skill` invocations** — use the Agent tool with the skill's SKILL.md content as the prompt
- **NEVER combine the orchestrator with implementation** — this skill coordinates, it does not modify application code directly
