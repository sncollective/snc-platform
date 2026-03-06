---
name: platform-refactor-fix
description: "Implement a specific finding from a platform-refactor-plan report. Use when a refactor report exists and you want to apply a particular finding."
argument-hint: [scope finding-id — e.g., "middleware P1.1", "routes P0.2"]
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, Task
model: sonnet
---
# Refactor Fix — Implement a Finding from a Refactor Report

You implement a specific finding from a `platform-refactor-plan` report. The analysis is already done — your job is to read the finding, make the changes it describes, verify with tests, and report back.

## Arguments

$ARGUMENTS

Format: `<scope> <finding-id>` where:
- `<scope>` maps to `platform/docs/refactor/refactor-{scope}.md`
- `<finding-id>` is a priority tier + number, e.g., `P1.3`, `P0.1`, `P2.2`
- Multiple coupled findings use `+` syntax: `P1.1+P1.2`

## Step 1: Parse & Load

1. Parse `$ARGUMENTS` into scope and finding ID(s).
2. Read `platform/docs/refactor/refactor-{scope}.md`.
3. Locate the finding(s) by matching the priority section header (e.g., `## P1`) and finding number within it. Findings are numbered sequentially within each priority tier — `P1.3` means the 3rd finding under `## P1 — High Value`.
4. Extract the full finding block including all fields (Location, Affected files, Proposed consolidation/Fix, Estimated scope, Pattern reference, Tests affected, Verify checklist).

If the report file does not exist, or the finding ID cannot be matched, use **AskUserQuestion** to ask the user to clarify.

If the finding is **P3** or **Skip** priority, use **AskUserQuestion** to confirm — these were deprioritized for a reason.

## Step 2: Load Conventions

1. Read `platform/CLAUDE.md` for coding conventions.
2. Read `platform/.claude/rules/patterns.md` for the pattern index.
3. If the finding's "Pattern reference" field names a specific pattern, read its full file from `platform/.claude/skills/platform-patterns/`. This ensures the implementation follows established conventions exactly.

## Step 3: Implement

1. Read **all** files listed in the finding's "Affected files" field. Also read any files mentioned in "Location" or "Tests affected". Understand the current state before changing anything.
2. Compare the current code against the finding's description of "Current state". If the code has changed significantly since the report was generated, tell the user the finding may be stale and ask whether to proceed or regenerate the report.
3. If the finding offers multiple options (e.g., "Option A" vs "Option B"), use **AskUserQuestion** to ask the user which approach to take.
4. Implement the changes described in the finding's "Proposed consolidation" / "Fix" field. Follow the report's specific guidance — file locations, approach, estimated scope.
5. Do **not** modify files outside the finding's "Affected files" list without flagging it to the user first. Scope creep defeats the purpose of targeted fixes.

## Step 4: Verify

Run the verification checklist from the finding:

1. Run tests for every package that was touched:
   - `cd platform && pnpm --filter @snc/api test` (if API files changed)
   - `cd platform && pnpm --filter @snc/shared test` (if shared package files changed)
   - `cd platform && pnpm --filter @snc/web test` (if web files changed)
2. Confirm no new public APIs were introduced (unless the finding explicitly calls for one, like adding an error subclass to `@snc/shared`).
3. Confirm behavior is unchanged — this is a structural refactor, not a feature.

If tests fail after implementation, report the failure. Do not attempt to fix tests beyond what the finding describes — the user decides next steps.

## Step 5: Update the Report

After successful verification, update the refactor report to mark the finding as implemented:

1. Check off the verify items: replace `[ ]` with `[x]` in the finding's **Verify** line.
2. Add an `- **Implemented**: [date]` line at the end of the finding block (before the `---` separator).

If tests failed or verification was only partial, check off only the items that passed and add `- **Partially implemented**: [date] — [brief reason]` instead.

After updating the finding, scan the report for remaining unchecked items (`[ ]`) across all P0, P1, and P2 findings. Tell the user how many are left (e.g., "2 of 5 P1/P2 findings remaining"). If all are done, suggest running `/platform-refactor-validate {scope}` to run cross-finding regression checks and archive the report.

## Step 6: Report

Tell the user:
- What was changed (files modified, lines added/removed)
- Test results (pass/fail counts for each package tested)
- Whether the finding's verification checklist is fully satisfied
- Whether any pattern docs need updating (link to the relevant `platform-patterns` file)
- If implementing this finding unblocks other findings from the same report, mention them with their IDs
- Report completion status (remaining findings or archived)

## Anti-Patterns

- **NEVER deviate from the report's proposed fix** without asking the user first — the analysis was already done
- **NEVER implement P3/Skip findings** without explicit user confirmation — these were deprioritized for a reason
- **NEVER skip running tests** — verification is the whole point of separating analysis from implementation
- **NEVER modify files outside the finding's "Affected files"** without flagging it — scope creep defeats the purpose of targeted fixes
- **NEVER combine findings** unless `$ARGUMENTS` explicitly uses `+` syntax or the report's "Suggested Implementation Order" says they are coupled
- **NEVER add features, refactor surrounding code, or "improve" things beyond the finding** — implement exactly what the report says

## Edge Cases

- **Finding references a pattern that doesn't exist yet**: Create a stub pattern doc in `platform/.claude/skills/platform-patterns/` and note it in the report output.
- **Tests fail after implementation**: Report the failure with full output. Do not attempt to fix tests beyond what the finding describes.
- **Finding is stale** (code changed since the report was generated): Read the current code, compare with the report's "Current state" description. If the finding still applies, proceed. If the code already changed significantly, tell the user the report may need regeneration via `/platform-refactor-plan {scope}`.
