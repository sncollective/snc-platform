# Performance: Data Efficiency

> Fetch only the data needed — select specific columns and paginate unbounded lists.

## What to Flag

- Drizzle `.select()` without column specification when only a subset is used downstream — wastes memory, bandwidth, and exposes unnecessary data
- List endpoints without pagination (cursor or offset-based) — unbounded result sets grow with data
- API responses including fields the client never uses (over-fetching)

## What NOT to Flag

- Single-row lookups by ID where all columns are needed for the response
- Queries where the full row is passed to a transformer that uses most fields
- Admin/dashboard queries where completeness matters more than efficiency
- Queries that are already paginated via cursor-based pagination

## From This Codebase

**Not flaggable**: `content.routes.ts` lines 271-288 — feed query explicitly selects 16 specific columns rather than selecting everything.

**Not flaggable**: `content.routes.ts` lines 99-103 — creator info query selects only 2 columns: `{ name: creatorProfiles.displayName, handle: creatorProfiles.handle }`.

**Not flaggable**: All list endpoints use cursor-based pagination via `use-cursor-pagination.ts` and `cursor.ts` — no unbounded result sets.

**Flaggable**: `content.routes.ts` line 512 — single-content lookup uses `.select()` without column specification. If the response only needs a subset of the 14+ content columns, this over-fetches.

**Flaggable pattern** (synthetic):
```typescript
// BAD: selects all columns when only id + title needed for a dropdown
const items = await db.select().from(content);
return items.map((i) => ({ value: i.id, label: i.title }));

// GOOD: select only what's needed
const items = await db
  .select({ id: content.id, title: content.title })
  .from(content);
```

## Confidence

- SELECT * when only a few columns are used → **medium** (Analyze lane — need to trace usage downstream)
- Unbounded list without pagination → **high** (Fix lane)
