---
name: security-scan
description: >
  Scan the platform codebase for security issues and populate the security board.
  Places findings on the correct board and lane based on complexity and domain.
  Use when auditing platform security, checking for vulnerabilities, or running
  a security review cycle. Trigger on "security scan", "audit security",
  "check for vulnerabilities", "run security review".
allowed-tools: Read, Glob, Grep, Bash, Agent, Write, Edit, AskUserQuestion
---

# Security Refactor — Platform Security Scanner

Scan the platform codebase for security issues based on project-specific rules. Classify each finding and place it on the appropriate board and lane.

Each rule has a reference file in `${CLAUDE_SKILL_DIR}/references/` with rationale, before/after examples, and exceptions.

## Rules

| Rule | Domain | Summary | Reference |
|------|--------|---------|-----------|
| deny-by-default | code | All routes require `requireAuth` unless explicitly public | [details](references/deny-by-default.md) |
| schema-at-boundary | code | Every handler accepting input must use `zValidator` with a Zod schema | [details](references/schema-at-boundary.md) |
| parameterized-queries-only | code | All DB queries via Drizzle ORM; no raw SQL string interpolation | [details](references/parameterized-queries-only.md) |
| error-sanitization | code | Client errors use typed AppError codes; server logs redact PII/secrets | [details](references/error-sanitization.md) |
| no-secrets-in-output | code | Error messages, logs, and API responses never contain secrets or tokens | [details](references/no-secrets-in-output.md) |
| audit-security-events | code | Auth failures, authz denials, role changes, and admin actions are logged structurally | [details](references/audit-security-events.md) |
| webhook-verification | code | All inbound webhooks verify signatures; unknown event types are logged | [details](references/webhook-verification.md) |
| rate-limit-auth | code | Auth endpoints (login, signup, OTP) have strict per-IP rate limits | [details](references/rate-limit-auth.md) |
| defense-in-depth-headers | code | `secureHeaders()` applied globally as app-level complement to Caddy | [details](references/defense-in-depth-headers.md) |
| presigned-url-controls | cross-cutting | S3 presigned URLs use minimum expiry; uploads enforce MIME/size limits | [details](references/presigned-url-controls.md) |
| audit-on-ci | cross-cutting | CI runs `pnpm audit`; fails on critical/high vulnerabilities | [details](references/audit-on-ci.md) |

## Step 1: Load Context

1. Read `platform/CLAUDE.md` for project conventions and Agent Commands.
2. Read the rule reference files relevant to the scan scope. If `$ARGUMENTS` specifies a scope (e.g., "routes", "auth", "storage"), read only the rules that apply. If no scope, read all rules.
3. Read the target boards:
   - **Security board**: `boards/platform/security/BOARD.md` (must have `pipeline: security`)
   - **Infra board**: `boards/infra/BOARD.md` (generic, for infra/cross-cutting findings)
4. Note existing items on both boards to avoid duplicating findings already tracked.

## Step 2: Scan

Scan the platform codebase against each rule. For each violation found, record:

- **Rule**: which rule was violated
- **File**: exact file path and line number
- **Issue**: what's wrong (one sentence)
- **Fix**: proposed change (specific enough to implement)
- **Domain**: `code`, `infra`, or `cross-cutting`

Read the rule's reference file for before/after examples and exception conditions. Do not flag violations that match a documented exception.

## Step 3: Classify and Assign Severity

For each finding, assign a severity (S0–S3) and classify by complexity:

| Severity | Criteria |
|----------|----------|
| **S0** | Actively exploitable, data exposure, auth bypass |
| **S1** | Exploitable with effort, missing auth checks, injection vectors |
| **S2** | Defense-in-depth gaps, missing headers, verbose errors |
| **S3** | Hardening opportunities, best-practice alignment |

Classify complexity:

| Complexity | Description | Target |
|------------|-------------|--------|
| **Simple code fix** | Clear fix, single file, no design needed (e.g., add `requireAuth`, add `zValidator`) | Security board → **Implement** |
| **Complex code fix** | Multiple files, needs design, requires research or user input | Security board → **Design** (ready) or **Backlog** (needs discussion) |
| **Infra / cross-cutting** | Requires infrastructure changes the agent cannot implement | Infra-security board → **Backlog** |

If a finding's complexity is ambiguous, ask the user via **AskUserQuestion**.

## Step 4: Place Findings on Boards

### Security board (`boards/platform/security/BOARD.md`)

For each code finding, append a checklist item to the appropriate lane:

**Implement lane** (simple fixes):
```
- [ ] **[S{n}] {Rule}: {Issue}** — `{file}:{line}` — Fix: {proposed change}
```

**Design lane** (complex fixes needing design docs):
```
- [ ] **[S{n}] {Rule}: {Issue}** — Scope: {files/area affected}. Needs: {what the design should address}
```

**Backlog lane** (needs research or user discussion):
```
- [ ] **[S{n}] {Rule}: {Issue}** — {why this needs discussion before it's ready}
```

### Infra board (`boards/infra/BOARD.md`)

For infra and cross-cutting findings, append to the **Backlog** lane:
```
- [ ] *(infra)* **{Rule}: {Issue}** — {location/config} — Suggested: {remediation approach}
```
or:
```
- [ ] *(cross-cutting)* **{Rule}: {Issue}** — Code portion: {file}; Infra portion: {config/service}
```

### Deduplication

Before adding an item, check if a matching item already exists on the board (same rule + same file/location). If it does, skip it. If the existing item has different severity or details, update it in place.

### Accepted Risk

Findings that match a rule's documented exception, or where the violation is intentional and mitigated elsewhere, are **not placed on the board**. Instead, note them in the scan summary (Step 5) with the rationale for acceptance.

Update `updated:` in both boards' frontmatter to today's date.

## Step 5: Report

Tell the user:

- **Findings placed**: count per severity tier (S0/S1/S2/S3) and per lane (Implement/Design/Backlog)
- **Infra findings**: count routed to infra board
- **Accepted risk**: count with brief rationale for each
- **Skipped (duplicates)**: count of findings already tracked on the board
- **Top priority**: the highest-severity findings with one-line summaries

## Pipeline Chain

After reporting, offer to invoke the next pipeline skill based on what was placed:

- If items were placed in **Design**: "Design lane has new items. Run `/design` to create design docs?"
- If items were placed in **Implement** (and no Design items): "Implement lane has simple fixes ready. Run `/security-fix` to start fixing?"
- If only Backlog/infra items: "All findings need discussion or human action. No pipeline skill to chain to."

## Anti-Patterns

- **NEVER implement fixes** — this skill scans and places findings. `/security-fix` implements.
- **NEVER place items on a board without checking for duplicates** — existing items should not be re-added.
- **NEVER flag documented exceptions** — read the rule's reference file for exception conditions.
- **NEVER place infra findings on the security board** — they go to the infra board (`boards/infra/BOARD.md`).
- **NEVER skip accepted-risk reporting** — the user needs to see what was intentionally not flagged.
