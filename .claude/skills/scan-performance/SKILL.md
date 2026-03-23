---
name: scan-performance
description: >
  Performance scan guidelines for the SNC platform. Covers query efficiency,
  layout stability (CLS), loading strategy (LCP), bundle awareness, and data
  efficiency. Loaded by refactor-scan as a rule library.
---

# Performance Scan Guidelines

Guidelines for identifying performance issues: query efficiency, layout stability,
loading strategy, bundle awareness, and data efficiency. Findings target measurable
Core Web Vitals impact or quantifiable server-side waste.

## Categories

| Category | Slug prefix | What to look for | Reference |
|----------|------------|------------------|-----------|
| Query efficiency | `query` | N+1 queries, independent DB queries not batched, missing Drizzle `with()` | [details](references/query-efficiency.md) |
| Layout stability (CLS) | `cls` | Images missing width/height, animations on layout properties | [details](references/layout-stability.md) |
| Loading strategy (LCP) | `lcp` | Below-fold images missing loading="lazy", missing fetchpriority, missing preconnect | [details](references/loading-strategy.md) |
| Bundle awareness | `bundle` | zod vs zod/mini drift in web app, heavy imports | [details](references/bundle-awareness.md) |
| Data efficiency | `data` | Over-fetching (SELECT * equivalent), unbounded list endpoints | [details](references/data-efficiency.md) |

## Confidence Mapping

| Finding type | Typical confidence | Lane |
|-------------|-------------------|------|
| N+1 query (await in loop body) | high | Fix |
| Image missing width/height | high | Fix |
| Animation on layout property | high | Fix |
| zod import in web app (not zod/mini) | high | Fix |
| Below-fold image missing loading="lazy" | high | Fix |
| Drizzle query without column selection | medium | Analyze |
| Missing fetchpriority="high" on hero image | medium | Analyze |
| Relational query opportunity (with() vs separate queries) | medium | Analyze |
| Missing preconnect for third-party origin | low | Backlog |
| Heavy dependency suggestion | low | Backlog |

React 19 with React Compiler auto-memoizes at build time. Do not flag missing
React.memo, useMemo, or useCallback — these are handled by the compiler.

For general independent async operations, see the `concurrent-awaits` rule in
scan-stylistic. This library covers DB-specific and web-vitals-specific patterns.

See `docs/research/scan-rules-perf-a11y-2026-03.md` for full research justification.
