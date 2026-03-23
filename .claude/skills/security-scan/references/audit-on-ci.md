# Rule: Audit on CI

> CI pipelines run `pnpm audit` and fail on critical/high vulnerabilities.

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
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm build
```

**After:**
```yaml
jobs:
  test:
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --prod --audit-level=high
      - run: pnpm test
      - run: pnpm build
```

### Synthetic example: ignoring audit results

**Before:**
```yaml
- run: pnpm audit || true  # Ignores all vulnerabilities
```

**After:**
```yaml
- run: pnpm audit --prod --audit-level=high  # Fails on high/critical
```

## Exceptions

- Dev dependencies (`--prod` flag excludes them — dev tools don't ship to production)
- Known false positives can be suppressed via `.pnpmauditrc` with documented rationale

## Scope

- Applies to: `.forgejo/workflows/test-and-build.yml`, any CI pipeline that builds production artifacts
- Does NOT apply to: local development, manual audits (which are supplementary)
