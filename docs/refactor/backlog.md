# Refactor Backlog

Deferred items from refactor analysis. Revisit when touching nearby code or during future planning cycles.

> Last updated: 2026-03-11

---

## P3 Findings

### lib (archived 2026-03-09)
- `apps/web/src/lib/content.ts` — no unit tests
- `apps/web/src/lib/subscription.ts` — no unit tests
- `apps/web/src/lib/config.ts` — no unit tests
- `apps/web/src/lib/emissions.ts` — no unit tests

### components (archived 2026-03-09)
- `apps/web/src/components/content/content-form.tsx` — no unit tests
- `apps/web/src/routes/settings/content.tsx` (MyContentList) — no unit tests
- ~~`apps/web/src/components/content/content-form.tsx` — three file-input blocks (media, cover art, thumbnail) follow identical pattern; `FileInputField` sub-component would reduce ~60 lines~~ — resolved 2026-03-11 (`FileInputField` private component extracted at line 39, used 3×)

### routes (archived 2026-03-09)
- Loader return type casts via `fetchApiServer` — several routes cast response as specific types

### emissions (archived 2026-03-09)
- ~~`apps/api/src/routes/emissions.routes.ts:176-179` — Raw SQL template strings for monthly aggregation lack type safety; consider Drizzle's `sql.mapWith()` or `.$type<number>()`~~ — resolved 2026-03-11 (SQL expressions now use `sql<string>` and `sql<number>` type generics)
- `apps/web/src/components/emissions/emissions-chart.tsx` — 332-line component with SVG rendering could be split into subcomponents (GridLines, DataLines, Legend, Tooltip)
- `apps/web/src/lib/chart-math.ts:3-6` — `MONTHS` array duplicates locale-aware formatting that `Intl.DateTimeFormat` could provide
- `apps/api/scripts/import-emissions.ts:61` — `JSON.parse(raw) as EmissionsFile` has no runtime validation; consider Zod schema

### checkout (archived 2026-03-09)
- `apps/web/src/routes/checkout/success.module.css` + `cancel.module.css` — style duplication

### dashboard (archived 2026-03-09)
- ~~Revenue test fake timers — consider extracting date range logic for testability~~ — resolved 2026-03-11 (date logic uses `new Date()` controlled by `vi.setSystemTime()`; already testable)
- ~~`apps/web/src/components/dashboard/revenue-chart.tsx` — `MAX_BAR_HEIGHT = 200` magic number (matches CSS)~~ — resolved 2026-03-11 (has inline comment `// px — matches CSS .barRow height`; documented sufficiently)
- Dashboard `useOptimistic` consideration for booking review actions
- ~~`apps/web/src/components/dashboard/pending-bookings-table.tsx:18-27` — `formatPreferredDates` is a pure utility inlined as private function; if booking date formatting is needed elsewhere, move to `lib/format.ts`~~ — resolved 2026-03-11 (only used in one component; no need to extract)

### creator (archived 2026-03-09)
- ~~Creator settings `userId` initialization pattern — `useState("")` then effect-set from session~~ — resolved 2026-03-11 (appropriate for async auth flow with `fetchAuthState()`)

### booking (archived 2026-03-09)
*(all items resolved)*

### middleware (archived 2026-03-06)
- `apps/api/src/middleware/error-handler.ts:40` — `details` extraction via duck-typing (`"details" in e ? (e as ...).details`); consider adding `details?: unknown` to `AppError` base class

### merch (archived 2026-03-09)
- `apps/web/src/components/merch/product-card.module.css` / `product-detail.module.css` — imagePlaceholder gradient duplicated (2 occurrences, same domain; marked intentional in comments)

### subscription (archived 2026-03-09)
- ~~`apps/api/src/routes/subscription.routes.ts:97-99` — `CancelResponseSchema` module-scope definition could benefit from pattern reference comment~~ — resolved 2026-03-11 (JSDoc comment added referencing UploadQuerySchema pattern)

### content (archived 2026-03-09)
- ~~`apps/api/src/routes/content.routes.ts:178` — destructured field renames (`type: typeFilter`) add cognitive overhead~~ — resolved 2026-03-11 (standard destructuring, not confusing renames)

### admin (archived 2026-03-09)
- `admin.routes.ts:98` — `c.req.valid("query" as never) as AdminUsersQuery` double cast. Known Hono-OpenAPI typing limitation, cross-cutting concern.

---

## Best Practices

*(Populated automatically by `/platform-refactor-validate` when archiving scopes with best practice findings.)*

### React Compiler (from components, 2026-03-09)
| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| Manual `useMemo`/`useCallback` | React Compiler auto-memoization | Low — evaluate when stable |

### clsx/lite (from components, 2026-03-09)
| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| Template string classNames | `clsx/lite` conditional classNames | Low — drop-in replacement |

### CSS composes (from styles, 2026-03-09)
| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| Multi-import CSS modules | CSS `composes` for shared styles | Medium — requires restructuring module imports |

### ~~Stripe v20.4~~ (from subscription, 2026-03-09) — resolved 2026-03-11
All Stripe service modules (`stripe.ts`, `revenue.ts`) now use `wrapStripeErrorGranular` which maps Stripe SDK error subclasses to appropriate HTTP status codes (400/429/500/502).

### Hono v4.12 (from middleware, 2026-03-06)
| Current Approach | Recommended | Migration Effort |
|------------------|-------------|------------------|
| Explicit `MiddlewareHandler<AuthEnv>` type annotation | `createMiddleware<AuthEnv>()` from `hono/factory` — infers types, reduces boilerplate | Low |

---

## OSS Alternatives

### recharts (from emissions, 2026-03-09)
- **Replaces**: Hand-rolled SVG chart in `emissions-chart.tsx` (332 LOC)
- **Weekly DL**: ~2.3M | **Size**: ~200KB
- **Recommendation**: evaluate — not recommended unless more charts are added

### d3-scale (from emissions, 2026-03-09)
- **Replaces**: `niceTicks`/`niceNum` in `chart-math.ts` (26 LOC)
- **Weekly DL**: ~4.5M | **Size**: small (single module)
- **Recommendation**: keep — current implementation is well-tested, trivial gain

### hono-rate-limiter (from middleware, 2026-03-06)
- **Replaces**: Hand-rolled `rateLimiter` in `rate-limit.ts` (67 LOC)
- **Weekly DL**: ~163 | **Size**: small
- **Recommendation**: evaluate when scaling to multiple API instances (Redis store for shared rate limit state)
