# Refactor Backlog

Deferred items from refactor analysis. Revisit when touching nearby code or during future planning cycles.

> Last updated: 2026-03-11

---

## P3 Findings

### lib (archived 2026-03-09)
- `apps/web/src/lib/content.ts` — no unit tests
- `apps/web/src/lib/merch.ts` — no unit tests
- `apps/web/src/lib/booking.ts` — no unit tests
- `apps/web/src/lib/dashboard.ts` — no unit tests
- `apps/web/src/lib/creator.ts` — no unit tests
- `apps/web/src/lib/subscription.ts` — no unit tests

### components (archived 2026-03-09)
- `apps/web/src/components/content/content-form.tsx` — no unit tests
- `apps/web/src/routes/settings/content.tsx` (MyContentList) — no unit tests

### routes (archived 2026-03-09)
- `apps/api/src/routes/content.routes.ts:247` — `as FeedRow[]` cast (Drizzle join return type)
- Loader return type casts via `fetchApiServer` — several routes cast response as specific types

### emissions (archived 2026-03-09)
- `apps/api/src/routes/emissions.routes.ts:176-179` — Raw SQL template strings for monthly aggregation lack type safety; consider Drizzle's `sql.mapWith()` or `.$type<number>()`
- `apps/web/src/components/emissions/emissions-chart.tsx` — 332-line component with SVG rendering could be split into subcomponents (GridLines, DataLines, Legend, Tooltip)
- `apps/web/src/lib/chart-math.ts:3-6` — `MONTHS` array duplicates locale-aware formatting that `Intl.DateTimeFormat` could provide
- `apps/api/scripts/import-emissions.ts:61` — `JSON.parse(raw) as EmissionsFile` has no runtime validation; consider Zod schema
- `packages/shared/src/emissions.ts:8` — `scope: z.number().int()` lacks `.min(0).max(3)` constraint
- `packages/shared/src/emissions.ts:79` — Monthly breakdown `month` field uses `z.string()` instead of `z.string().regex(/^\d{4}-\d{2}$/)` for YYYY-MM format
- `apps/web/src/routes/emissions.tsx:63` — `breakdown.summary.netCo2Kg.toFixed(1)` is inline formatting; could use `formatCo2` for consistency

### checkout (archived 2026-03-09)
- `apps/web/src/routes/checkout/success.tsx` — magic numbers (poll interval, max attempts)
- `apps/web/src/routes/checkout/success.module.css` + `cancel.module.css` — style duplication

### dashboard (archived 2026-03-09)
- Revenue test fake timers — consider extracting date range logic for testability
- `apps/web/src/components/dashboard/revenue-chart.tsx` — `MAX_BAR_HEIGHT = 200` magic number (matches CSS)
- Dashboard `useOptimistic` consideration for booking review actions

### creator (archived 2026-03-09)
- Creator settings `userId` initialization pattern — `useState("")` then effect-set from session

### booking (archived 2026-03-09)
- `reviewNote` not displayed in `BookingList` component (data exists but UI omits it)

### admin (archived 2026-03-09)
- `admin.routes.ts:98` — `c.req.valid("query" as never) as AdminUsersQuery` double cast. Known Hono-OpenAPI typing limitation, cross-cutting concern.
- `admin.routes.ts:196,249` — `c.json({ user: user! })` non-null assertion after verified-exists check. Guard clause would be safer.
- `user-role-manager.tsx:25` — Extra whitespace in `useState<Role | "">(""  )`. Cosmetic only.

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
