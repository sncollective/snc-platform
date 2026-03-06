---
name: platform-refactor-validate
description: "Run cross-finding regression checks, verify all findings are resolved, and archive a completed refactor report. Use after all findings in a scope have been implemented via platform-refactor-fix."
argument-hint: [scope — e.g., "middleware", "routes"]
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash, Edit, Write, AskUserQuestion
model: sonnet
---
# Refactor Validate — Post-Implementation Verification & Archive

You run deep verification after all findings in a refactor report have been implemented. You check for cross-finding regressions, run the full test suite, update the Pattern Compliance table, and archive the completed report.

## Arguments

$ARGUMENTS

Format: `<scope>` where scope maps to `platform/.claude/skills/platform-refactor-plan/reports/refactor-{scope}.md`.

## Step 1: Load the Report

1. Read `platform/.claude/skills/platform-refactor-plan/reports/refactor-{scope}.md`.
2. If the file does not exist, check `reports/archive/` — if it's already archived, tell the user and stop.
3. If neither exists, tell the user no report was found and suggest running `/platform-refactor-plan {scope}`.

## Step 2: Check Completion Status

Scan all P0, P1, and P2 findings for unchecked verify items (`[ ]`).

- If **all** verify items are checked (`[x]`): proceed to Step 3.
- If **unchecked items remain**: list them with their finding IDs and ask the user whether to:
  - **Proceed anyway** — run validation on what's done so far
  - **Stop** — fix remaining findings first via `/platform-refactor-fix {scope} {finding-id}`

## Step 3: Run Test Suite

Run tests for every package that had files touched across **all** findings in the report. Collect the affected packages by scanning the "Affected files" and "Location" fields of every finding.

```
cd platform && pnpm --filter @snc/api test      # if any apps/api/ files were touched
cd platform && pnpm --filter @snc/shared test    # if any packages/shared/ files were touched
cd platform && pnpm --filter @snc/web test       # if any apps/web/ files were touched
```

Report pass/fail counts for each package.

If tests fail, report the failures with full output. Ask the user whether to continue validation or stop to fix.

## Step 4: Cross-Finding Regression Check

This is the key value of validate over individual fix verification. Look for interactions between findings:

1. Collect every file modified across all findings (from "Affected files" fields).
2. Read each modified file.
3. Check for:
   - **Type mismatches**: A type changed in one finding that's imported by a file changed in another finding
   - **Import breakage**: A moved/renamed export that other findings depend on
   - **Shared state conflicts**: Multiple findings modifying the same helper, utility, or constant
   - **Test coverage gaps**: A finding's tests that don't account for changes made by another finding
4. Report any regressions found. If none, confirm clean cross-finding check.

## Step 5: Update Pattern Compliance

Read the report's "Pattern Compliance" table. For each entry with status `Drift`:

1. Check whether the drift was addressed by any of the implemented findings.
2. If the code now matches the pattern, update the status from `Drift` to `Fixed`.
3. If drift remains, leave as `Drift` and note it in the final report.

## Step 6: Archive

1. Ensure `platform/.claude/skills/platform-refactor-plan/reports/archive/` directory exists (create if needed).
2. Move the report from `reports/refactor-{scope}.md` to `reports/archive/refactor-{scope}.md`.
3. Add an archive header to the top of the moved file:

```markdown
> **Archived**: [date]
> **Validation**: All tests passing, no cross-finding regressions
```

## Step 7: Report

Tell the user:
- **Test results**: pass/fail counts per package
- **Cross-finding regressions**: any found, or "None — clean"
- **Pattern Compliance updates**: any `Drift` → `Fixed` changes
- **Archive confirmation**: where the report was moved
- **Remaining work**: any unchecked items that were skipped (if user chose to proceed anyway in Step 2)

## Anti-Patterns

- **NEVER implement fixes** — this skill validates and archives, it does not change application code
- **NEVER skip the test suite** — running tests is the primary purpose of validation
- **NEVER archive a report with failing tests** without explicit user approval
- **NEVER modify the report content** beyond Pattern Compliance updates and the archive header
