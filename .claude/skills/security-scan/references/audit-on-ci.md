# Rule: Audit on CI

> CI pipelines run `bun audit` and fail on critical/high vulnerabilities.

**Domain**: cross-cutting

## Motivation

OWASP A06 (Vulnerable and Outdated Components). Dependencies are the largest attack surface in a Node.js app. Automated scanning in CI catches known vulnerabilities before they reach production. Without it, vulnerability detection is manual and sporadic.

## Before / After

### From this codebase: CI workflow without audit step

**Before:**
```yaml
# .forgejo/workflows/test-and-build.yml — no audit step
jobs:
  test:
    steps:
      - uses: actions/checkout@v4
      - run: bun install --frozen-lockfile
      - run: bun run test:unit
      - run: bun run build
```

**After:**
```yaml
jobs:
  test:
    steps:
      - uses: actions/checkout@v4
      - run: bun install --frozen-lockfile
      - run: bun audit --audit-level=high
      - run: bun run test:unit
      - run: bun run build
```

### Synthetic example: ignoring audit results

**Before:**
```yaml
- run: bun audit || true  # Ignores all vulnerabilities
```

**After:**
```yaml
- run: bun audit --audit-level=high  # Fails on high/critical
```

## Exceptions

- Bun audit does not currently support a `--prod` filter, so dev-tree advisories surface alongside production ones. Filter by severity (`--audit-level=high`) and suppress known false positives via `--ignore <CVE-ID>` with a documented rationale.

## Scope

- Applies to: `.forgejo/workflows/platform-*.yml`, any CI pipeline that builds production artifacts
- Does NOT apply to: local development, manual audits (which are supplementary)
