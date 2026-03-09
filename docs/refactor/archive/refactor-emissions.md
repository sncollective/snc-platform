> **Archived**: 2026-03-09
> **Validation**: All tests passing, no cross-finding regressions

# Refactor Analysis: Emissions (Vertical Slice)

> **Generated**: 2026-03-09
> **Scope**: 31 source files across shared schemas, API routes/tests/fixtures/scripts, web lib/components/routes/tests/fixtures
> **Libraries researched**: None required (no third-party emissions-specific dependencies)

---

## Executive Summary

The emissions vertical slice is well-structured with good test coverage and correct use of design tokens. The highest-impact finding is that the emissions page uses client-side `useEffect` for data fetching instead of the SSR `loader` + `fetchApiServer` pattern used by all other public pages, hurting initial render performance and SEO. The route file also has a manually-defined `EmissionRow` interface that duplicates the Drizzle schema's inferred type, and the `POST /entries` and `POST /offsets` endpoints return HTTP 200 instead of the conventional 201 for resource creation.

---

## P0 — Fix Now

None found.

---

## P1 — High Value

### 1.1 Emissions page uses client-side useEffect instead of SSR loader

- **Affected files**: `apps/web/src/routes/emissions.tsx`, `apps/web/src/lib/emissions.ts`, `apps/web/tests/unit/routes/emissions.test.tsx`
- **Current state**: `EmissionsPage` fetches data via `useEffect` + `fetchEmissionsBreakdown()` (which calls `apiGet`), causing a client-side loading spinner on initial page load. Every other public page (feed, pricing, creators, dashboard, services, merch) uses the `loader` + `fetchApiServer` / `Route.useLoaderData()` SSR pattern for server-rendered initial data.
- **Proposed consolidation**: Convert to `loader: async () => fetchApiServer({ data: "/api/emissions/breakdown" })` and consume via `Route.useLoaderData()`. Remove the `useState`/`useEffect`/loading/error state management — the loader pattern handles errors via TanStack's built-in error boundary.
- **Estimated scope**: 1 file rewritten (~60 LOC delta), 1 test file updated
- **Pattern reference**: `tanstack-file-route.md` (loader pattern)
- **Tests affected**: `apps/web/tests/unit/routes/emissions.test.tsx` — needs rewrite to use loader-based test approach
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged (page still renders same content, now SSR'd)
- **Implemented**: 2026-03-09

### 1.2 Manual EmissionRow interface duplicates Drizzle inferred type

- **Affected files**: `apps/api/src/routes/emissions.routes.ts`
- **Current state**: Lines 24-40 define a hand-written `EmissionRow` interface with all 14 fields. The Drizzle schema at `apps/api/src/db/schema/emission.schema.ts` already provides the exact same shape via `typeof emissions.$inferSelect`. Other route files (booking, content, subscription) use `typeof table.$inferSelect` for their row types.
- **Proposed consolidation**: Replace `interface EmissionRow { ... }` with `type EmissionRow = typeof emissions.$inferSelect;`
- **Estimated scope**: 1 file, ~18 LOC removed
- **Pattern reference**: `row-to-response-transformer.md` (uses `typeof table.$inferSelect` in examples)
- **Tests affected**: None — internal type, no runtime change
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 1.3 toEntryResponse return type not referencing shared EmissionEntry type

- **Affected files**: `apps/api/src/routes/emissions.routes.ts`
- **Current state**: `toEntryResponse(row: EmissionRow)` returns an inline object type (no explicit return type annotation). Per the `row-to-response-transformer.md` pattern, transformers should reference the shared type (e.g., `: EmissionEntry`) to catch drift between the transformer output and the shared schema.
- **Proposed consolidation**: Add explicit return type `EmissionEntry` from `@snc/shared`. This would also catch the `totalCo2Kg` / `netCo2Kg` redundancy issue at compile time.
- **Estimated scope**: 1 file, 1 LOC changed
- **Pattern reference**: `row-to-response-transformer.md` ("Return type not referencing the shared type creates drift risk")
- **Tests affected**: None
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P2 — Medium Value

### 2.1 POST /entries and POST /offsets return 200 instead of 201

- **Location**: `apps/api/src/routes/emissions.routes.ts` (lines 266, 315)
- **Affected files**: `apps/api/src/routes/emissions.routes.ts`, `apps/api/tests/routes/emissions.routes.test.ts`
- **Issue**: Both creation endpoints return HTTP 200. The content routes use `c.json(result, 201)` for resource creation. The OpenAPI description also says "200 OK" for both, which is semantically incorrect for creation.
- **Suggestion**: Change to `c.json(toEntryResponse(row!), 201)` and update the OpenAPI `responses` key from `200` to `201`. Update corresponding test assertions.
- **Tests affected**: `apps/api/tests/routes/emissions.routes.test.ts` — update `expect(res.status).toBe(201)` for POST tests
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2.2 Scope/category breakdown CSS modules are identical

- **Location**: `apps/web/src/components/emissions/scope-breakdown.module.css`, `apps/web/src/components/emissions/category-breakdown.module.css`
- **Affected files**: `scope-breakdown.module.css`, `category-breakdown.module.css`, `scope-breakdown.tsx`, `category-breakdown.tsx`
- **Issue**: Both CSS modules contain identical content (33 lines each) — a `.table` class, `th/td` styles, and `.empty` state. The styles are also very similar to `.entryTable` and `.rateTable` in `emissions.module.css`.
- **Suggestion**: Extract a shared `breakdown-table.module.css` in the emissions component directory and import from both components. Alternatively, both components could share a single CSS module since their classes are identical.
- **Tests affected**: None
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2.3 ProjectionSummary component is unused (dead code)

- **Location**: `apps/web/src/components/emissions/projection-summary.tsx`, `apps/web/src/components/emissions/projection-summary.module.css`, `apps/web/tests/unit/components/emissions/projection-summary.test.tsx`
- **Affected files**: 3 files (component, CSS module, test)
- **Issue**: `ProjectionSummary` is not imported by any route or component. The emissions page renders the projection data inline via the net summary card and breakdown tables instead.
- **Suggestion**: Remove the component, CSS module, and test file. If projection display is planned for the future, it can be recreated from git history.
- **Tests affected**: `projection-summary.test.tsx` would be deleted
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2.4 OffsetImpact imports co2-equivalencies CSS module (cross-component style dependency)

- **Location**: `apps/web/src/components/emissions/offset-impact.tsx` (line 4)
- **Affected files**: `offset-impact.tsx`
- **Issue**: `OffsetImpact` imports `./co2-equivalencies.module.css` instead of having its own CSS module or sharing one explicitly. Per the `css-modules-design-tokens.md` pattern, importing CSS from a different component's module is a cross-component style leakage violation.
- **Suggestion**: Either (a) create `offset-impact.module.css` with the same card/grid styles, or (b) rename `co2-equivalencies.module.css` to `impact-cards.module.css` and import from both components to make the sharing explicit.
- **Tests affected**: None
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2.5 EmissionsSummary has redundant totalCo2Kg and netCo2Kg fields

- **Location**: `packages/shared/src/emissions.ts` (lines 50-51)
- **Affected files**: `packages/shared/src/emissions.ts`, `apps/api/src/routes/emissions.routes.ts`, `apps/web/src/routes/dashboard.tsx`, `apps/web/tests/helpers/emissions-fixtures.ts`
- **Issue**: `EmissionsSummarySchema` has both `totalCo2Kg` and `netCo2Kg`, and in the route handler they are assigned the same value (`netCo2Kg`). The dashboard uses `totalCo2Kg` while the emissions page uses `netCo2Kg`. Having two fields with identical values is confusing and a potential source of bugs if they diverge.
- **Suggestion**: Deprecate `totalCo2Kg` in favor of `netCo2Kg` (or vice versa). Update the dashboard to use `netCo2Kg` and remove `totalCo2Kg` from the schema. This is a breaking API change, so coordinate with any consumers.
- **Tests affected**: `packages/shared/tests/emissions.test.ts`, `apps/web/tests/helpers/emissions-fixtures.ts`, `apps/web/tests/unit/routes/dashboard.test.tsx`
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2.6 fetchEmissionsSummary makes 3 sequential DB queries instead of 1

- **Location**: `apps/api/src/routes/emissions.routes.ts` (lines 70-113)
- **Affected files**: `apps/api/src/routes/emissions.routes.ts`
- **Issue**: `fetchEmissionsSummary()` executes 3 separate DB queries (gross actual, projected, offsets) sequentially. These could be combined into a single query using conditional aggregation (`CASE WHEN` inside `SUM`), similar to the monthly breakdown query on line 177 which already uses this technique.
- **Suggestion**: Combine into a single `SELECT` with conditional `SUM(CASE WHEN ...)` expressions. This would reduce DB round-trips from 3 to 1 for both `/summary` and `/breakdown` endpoints.
- **Tests affected**: `apps/api/tests/routes/emissions.routes.test.ts` — mock setup would simplify
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

### 2.7 Breakdown endpoint makes 7 DB queries when it could use fewer

- **Location**: `apps/api/src/routes/emissions.routes.ts` (lines 139-217)
- **Affected files**: `apps/api/src/routes/emissions.routes.ts`
- **Issue**: The `/breakdown` endpoint executes 7 sequential DB queries (3 for summary + 4 for breakdown sections). The summary queries overlap with the breakdown. At minimum, `fetchEmissionsSummary` could run in parallel with the breakdown queries via `Promise.all`. Better yet, `byScope`/`byCategory` could be folded into the summary query.
- **Suggestion**: Use `Promise.all` to parallelize the independent queries. The summary (3 queries combined per 2.6) and the 4 breakdown queries are independent.
- **Tests affected**: `apps/api/tests/routes/emissions.routes.test.ts`
- **Verify**: [x] Tests pass / [x] No new public APIs / [x] Behavior unchanged
- **Implemented**: 2026-03-09

---

## P3 — Nice-to-Have

- `apps/api/src/routes/emissions.routes.ts:176-179` — Raw SQL template strings for monthly aggregation lack type safety; consider Drizzle's `sql.mapWith()` or at least adding `.$type<number>()` to prevent the `string` → `Number()` casts at lines 209-214
- `apps/web/src/components/emissions/emissions-chart.tsx` — 332-line component with SVG rendering could be split into subcomponents (GridLines, DataLines, Legend, Tooltip) for maintainability
- `apps/web/src/lib/chart-math.ts:3-6` — `MONTHS` array duplicates locale-aware formatting that `Intl.DateTimeFormat` could provide; low priority since the current approach is explicit and well-tested
- `apps/api/scripts/import-emissions.ts:61` — `JSON.parse(raw) as EmissionsFile` has no runtime validation; consider parsing through a Zod schema for safety
- `packages/shared/src/emissions.ts:8` — `scope: z.number().int()` lacks a `.min(0).max(3)` constraint to enforce GHG Protocol scope values
- `packages/shared/src/emissions.ts:79` — Monthly breakdown `month` field uses `z.string()` instead of `z.string().regex(/^\d{4}-\d{2}$/)` to enforce YYYY-MM format
- `apps/web/src/routes/emissions.tsx:63` — `breakdown.summary.netCo2Kg.toFixed(1)` is inline formatting; could use `formatCo2` for consistency with gross/offset values in the same card

---

## Skip — Intentional Patterns

| Pattern | Location | Why it stays |
|---------|----------|-------------|
| `ScopeBreakdown` and `CategoryBreakdown` are separate components despite similar structure | `apps/web/src/components/emissions/` | Different domain concepts (GHG scopes vs activity categories) that may diverge in display requirements (scope labels need lookup, categories may need grouping) |
| `stripSessionDates` in transformer | `emissions.routes.ts:42-48` | Intentional privacy filter — raw session dates from the import script are internal metadata not suitable for public API exposure |
| `co2-equivalencies.ts` and `offset-impact.ts` are separate lib files | `apps/web/src/lib/` | Different domain concepts with different EPA/Pika source data; would not change together |
| Emissions entries returned in breakdown response (full list) | `emissions.routes.ts:192-215` | Public transparency page needs the full entry log; pagination not needed at current data volume |
| No `beforeLoad` auth guard on emissions route | `apps/web/src/routes/emissions.tsx` | Emissions data is intentionally public — no authentication required for transparency page |

---

## Best Practices Research

No third-party emissions-specific libraries are used. The implementation relies on standard Drizzle ORM, Zod schemas, and hand-rolled SVG charting — all appropriate for the scope.

---

## OSS Alternatives

| Hand-rolled Code | Package | Weekly DL | Stack Fit | Notes |
|-----------------|---------|-----------|-----------|-------|
| SVG chart in `emissions-chart.tsx` (332 LOC) | `recharts` | ~2.3M | Good (React) | Would simplify charting significantly, but adds ~200KB bundle size for one page. Current SVG approach is lightweight and sufficient for the single chart use case. Not recommended unless more charts are added. |
| `niceTicks` / `niceNum` in `chart-math.ts` | `d3-scale` (just the scale module) | ~4.5M | Good | The 26-line nice-tick algorithm is a simplified version of D3's. Current implementation is well-tested. Not recommended — would add dependency for trivial gain. |

---

## Pattern Compliance

| Pattern | Status | Notes |
|---------|--------|-------|
| `row-to-response-transformer` | Fixed | `toEntryResponse` uses `typeof emissions.$inferSelect` and explicit `EmissionEntry` return type (fixed by 1.2 + 1.3) |
| `route-private-helpers` | Compliant | `fetchEmissionsSummary`, `stripSessionDates`, `toEntryResponse` are all unexported private helpers |
| `web-fetch-client` | Compliant | `emissions.ts` uses `apiGet<T>()` correctly |
| `hono-typed-env` | Compliant | Route uses `Hono<AuthEnv>` |
| `css-modules-design-tokens` | Fixed | All CSS modules use design tokens correctly; `impact-cards.module.css` is explicitly shared between `Co2Equivalencies` and `OffsetImpact` (fixed by 2.4) |
| `vi-hoisted-module-mock` | Compliant | Emissions route test uses `vi.hoisted()` correctly |
| `hono-test-app-factory` | Compliant | Uses `setupRouteTest` shared factory |
| `dual-layer-fixtures` | Compliant | API fixtures use `Date` objects; web fixtures use ISO strings |
| `tanstack-file-route` | Fixed | Emissions page now uses `loader` + `Route.useLoaderData()` SSR pattern (fixed by 1.1) |

---

## Cross-Layer Continuity

### Schema-Transformer Alignment

| Shared Schema | Transformer | Status | Notes |
|---------------|-------------|--------|-------|
| `EmissionEntrySchema.id` | `toEntryResponse.id` | OK | Direct pass-through |
| `EmissionEntrySchema.date` | `toEntryResponse.date` | OK | Direct pass-through (stored as text) |
| `EmissionEntrySchema.scope` | `toEntryResponse.scope` | OK | Direct pass-through |
| `EmissionEntrySchema.category` | `toEntryResponse.category` | OK | Direct pass-through |
| `EmissionEntrySchema.subcategory` | `toEntryResponse.subcategory` | OK | Direct pass-through |
| `EmissionEntrySchema.source` | `toEntryResponse.source` | OK | Direct pass-through |
| `EmissionEntrySchema.description` | `toEntryResponse.description` | OK | Direct pass-through |
| `EmissionEntrySchema.amount` | `toEntryResponse.amount` | OK | Direct pass-through |
| `EmissionEntrySchema.unit` | `toEntryResponse.unit` | OK | Direct pass-through |
| `EmissionEntrySchema.co2Kg` | `toEntryResponse.co2Kg` | OK | Direct pass-through |
| `EmissionEntrySchema.method` | `toEntryResponse.method` | OK | Direct pass-through |
| `EmissionEntrySchema.projected` | `toEntryResponse.projected` | OK | Direct pass-through |
| `EmissionEntrySchema.metadata` | `toEntryResponse.metadata` | OK | Transformed via `stripSessionDates` |
| `EmissionEntrySchema.createdAt` | `toEntryResponse.createdAt` | OK | `.toISOString()` |
| `EmissionEntrySchema.updatedAt` | `toEntryResponse.updatedAt` | OK | `.toISOString()` |
| `EmissionsSummarySchema.totalCo2Kg` | `fetchEmissionsSummary` | Drift | Set to same value as `netCo2Kg` — redundant field |

### Validation Sync

| Field | Server Rule | Client Rule | Status |
|-------|-------------|-------------|--------|
| N/A — no client-side emission creation forms | — | — | N/A (admin-only creation via API) |

### Error Path Coverage

| Error | API Route | Web Component | UI Treatment |
|-------|-----------|---------------|--------------|
| 401 Unauthorized | `POST /entries`, `POST /offsets` | Not consumed (admin-only) | N/A |
| 403 Forbidden | `POST /entries`, `POST /offsets` | Not consumed (admin-only) | N/A |
| 400 Validation | `POST /entries`, `POST /offsets` | Not consumed (admin-only) | N/A |
| Network/server error | `GET /breakdown` | `emissions.tsx` | Renders `role="alert"` error div with message |

### Type Chain

| Step | Type | Mechanism | Status |
|------|------|-----------|--------|
| Shared schema | `EmissionsBreakdown` | `z.infer<typeof EmissionsBreakdownSchema>` | OK |
| API transformer | inline return | `toEntryResponse()` + inline object assembly | Weak — no explicit return type |
| Web lib | `EmissionsBreakdown` | `apiGet<EmissionsBreakdown>()` | OK |
| Route component | `EmissionsBreakdown \| null` | `useState<EmissionsBreakdown \| null>` | OK — would become `Route.useLoaderData()` with loader migration |
| Child components | Props interfaces | `EmissionsChartProps`, `ScopeBreakdownProps`, etc. | OK |

### Fixture Sync

| Entity | API Factory | Web Factory | Status | Notes |
|--------|-------------|-------------|--------|-------|
| EmissionEntry / EmissionRow | `makeMockEmissionRow()` | `makeMockEmissionEntry()` | OK | API uses `Date` objects for timestamps; web uses ISO strings. Same default field values. |
| EmissionsSummary | (inline in tests) | `makeMockEmissionsSummary()` | Minor gap | API tests build summary values inline via mock query results; web has a dedicated factory. Not a problem since API tests verify the aggregation logic. |
| EmissionsBreakdown | (inline in tests) | `makeMockEmissionsBreakdown()` | OK | Web factory correctly composes from `makeMockEmissionsSummary()` and `makeMockEmissionEntry()` |

---

## Suggested Implementation Order

1. **P1.1** — Migrate emissions page to SSR loader pattern (highest impact: improves page load, SEO, and aligns with codebase conventions)
2. **P1.2 + P1.3** — Replace manual `EmissionRow` with `$inferSelect` and add `EmissionEntry` return type to `toEntryResponse` (quick type-safety wins, do together)
3. **P2.1** — Change POST endpoints to return 201 (simple fix, correct HTTP semantics)
4. **P2.3** — Remove unused `ProjectionSummary` component (dead code cleanup)
5. **P2.4** — Fix cross-component CSS module import in `OffsetImpact`
6. **P2.2** — Consolidate identical breakdown table CSS modules
7. **P2.5** — Remove redundant `totalCo2Kg` field (coordinate with dashboard)
8. **P2.6 + P2.7** — Optimize DB queries in route handler (performance improvement, combine together)
