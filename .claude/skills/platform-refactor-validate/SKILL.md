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

Format: `<scope>` where scope maps to `docs/refactor/refactor-{scope}.md`.

## Step 1: Load the Report

1. Read `docs/refactor/refactor-{scope}.md`.
2. If the file does not exist, check `docs/refactor/archive/` — if it's already archived, tell the user and stop.
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
pnpm --filter @snc/api test      # if any apps/api/ files were touched
pnpm --filter @snc/shared test    # if any packages/shared/ files were touched
pnpm --filter @snc/web test       # if any apps/web/ files were touched
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

## Step 5.5: Extract Backlog Items

Before archiving, extract deferred items into the persistent backlog so they are not lost.

1. **Parse the report** for three sections:
   - **P3 items** — bullet lines under `## P3 — Nice-to-Have` (or `## P3 -- Nice-to-Have`). Skip if the section says "None found" or is empty.
   - **Best Practices** — the full `## Best Practices Research` section. Skip rows where the recommendation is "None needed" or the section says "No ... libraries" / "None required".
   - **OSS Alternatives** — the full `## OSS Alternatives` section. Skip if "No candidates identified" or empty table.

2. **Determine scope name** from the report filename: `refactor-{scope}.md` → `{scope}`.

3. **Read `docs/refactor/backlog.md`**. If the file does not exist, create it from this template:

```markdown
# Refactor Backlog

Deferred items from refactor analysis. Revisit when touching nearby code or during future planning cycles.

> Last updated: {today}

---

## P3 Findings

---

## Best Practices

---

## OSS Alternatives
```

4. **Update each section** using scope-based deduplication:

   - **P3 Findings**: Look for an existing `### {scope} (archived ...)` subsection.
     - If found, replace its content with the new P3 items — but preserve any lines prefixed with `~~[done]~~` or `~~[dismissed]~~` whose file path still appears in the new items list.
     - If not found, append a new `### {scope} (archived {today})` subsection with the P3 items.
     - If the report had no P3 items, do not add or modify the scope subsection.

   - **Best Practices**: For each library/tool mentioned:
     - Match by `### {Library}` heading — replace with latest table and update the `(from {scope}, {date})` annotation.
     - If no matching heading, append a new subsection.
     - Skip entries where the recommendation is "None needed" or equivalent.

   - **OSS Alternatives**: For each package mentioned:
     - Match by `### {Package}` heading — replace with latest assessment and update `(from {scope}, {date})`.
     - If no matching heading, append a new subsection.
     - Skip "No candidates identified" entries.

5. **Update the `> Last updated:` line** with today's date. Write the file.

If no P3 items, best practices, or OSS alternatives were found in the report, skip this step entirely.

## Step 6: Archive

1. Ensure `docs/refactor/archive/` directory exists (create if needed).
2. Move the report from `docs/refactor/refactor-{scope}.md` to `docs/refactor/archive/refactor-{scope}.md`.
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
- **Backlog extraction**: counts of P3 items, best practices, and OSS alternatives saved to `docs/refactor/backlog.md` (or "None — nothing to defer")
- **Archive confirmation**: where the report was moved
- **Remaining work**: any unchecked items that were skipped (if user chose to proceed anyway in Step 2)

## Anti-Patterns

- **NEVER implement fixes** — this skill validates and archives, it does not change application code
- **NEVER skip the test suite** — running tests is the primary purpose of validation
- **NEVER archive a report with failing tests** without explicit user approval
- **NEVER modify the report content** beyond Pattern Compliance updates and the archive header
